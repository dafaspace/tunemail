import AVFoundation
import Capacitor
import Foundation
import ShazamKit

/// Recognition for the native builds.
///
/// ShazamKit is a system framework on iOS 15 and later and costs nothing beyond
/// the developer programme, which replaces AudD's per-listen charge. It has no
/// web equivalent, so this is the only surface where recognition exists and the
/// web layer must ask `isAvailable` before offering a button.
///
/// `SHSession` plus `AVAudioEngine` rather than `SHManagedSession`: the managed
/// session is half the code but needs iOS 17, and the Capacitor project targets
/// iOS 15. Nothing here is worth excluding two OS versions of devices over.
///
/// The one result that matters more than the title is `isrc`. The app already
/// treats ISRC as the identifier that crosses platforms - it is what
/// `discoverIsrc` goes to the worker for - so a match that carries one lands
/// straight in the pipeline the app already has, rather than starting another
/// name-and-artist search.
@objc(ShazamPlugin)
public class ShazamPlugin: CAPPlugin, CAPBridgedPlugin, SHSessionDelegate {

    public let identifier = "ShazamPlugin"
    public let jsName = "Shazam"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private let engine = AVAudioEngine()
    private var session: SHSession?

    /// The call is held until a match arrives, the timeout fires or the caller
    /// cancels, and cleared the instant one of those happens. Every path out of
    /// listening goes through `finish`, so there is no way to resolve twice or
    /// to leave the microphone running because an error took an early return.
    private var pendingCall: CAPPluginCall?
    private var timeout: DispatchWorkItem?
    /// How many partial attempts said "not yet" before the outcome. Returned
    /// with the result so a miss on a real phone can be told apart from a
    /// window that was simply too short.
    private var missesSoFar = 0
    private let lock = NSLock()

    // MARK: - Bridge

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func cancel(_ call: CAPPluginCall) {
        finish(["matched": false, "cancelled": true])
        call.resolve()
    }

    @objc func listen(_ call: CAPPluginCall) {
        let seconds = call.getDouble("seconds") ?? 15.0
        missesSoFar = 0

        lock.lock()
        if pendingCall != nil {
            lock.unlock()
            call.reject("Already listening")
            return
        }
        call.keepAlive = true
        pendingCall = call
        lock.unlock()

        requestMicrophone { [weak self] granted in
            guard let self else { return }
            guard granted else {
                // A denied microphone is a settings problem, not a retry
                // problem, and saying so is the difference between someone
                // fixing it and someone tapping the button again.
                self.finish(reject: "Microphone access is off for Tunemail. Turn it on in Settings to identify songs.",
                            code: "permission")
                return
            }
            self.startListening(seconds: seconds)
        }
    }

    // MARK: - Listening

    private func startListening(seconds: Double) {
        let session = SHSession()
        session.delegate = self
        self.session = session

        do {
            let audio = AVAudioSession.sharedInstance()
            try audio.setCategory(.record, mode: .default, options: [])
            try audio.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            finish(reject: "Could not open the microphone: \(error.localizedDescription)", code: "audio")
            return
        }

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)

        // A zero sample rate means the route is not ready - a call in progress,
        // a just-revoked permission. Installing a tap on it throws inside
        // CoreAudio rather than returning an error, so it is checked here.
        guard format.sampleRate > 0, format.channelCount > 0 else {
            finish(reject: "The microphone is busy. Try again in a moment.", code: "audio")
            return
        }

        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 8192, format: format) { [weak session] buffer, time in
            session?.matchStreamingBuffer(buffer, at: time)
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            finish(reject: "Could not start listening: \(error.localizedDescription)", code: "audio")
            return
        }

        // Not an error: a song ShazamKit does not know sounds exactly like a
        // song it has not heard enough of yet, and both end here.
        let work = DispatchWorkItem { [weak self] in
            self?.finish(["matched": false, "reason": "timeout", "attempts": self?.missesSoFar ?? 0])
        }
        timeout = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }

    private func stopAudio() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        session = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// The single exit. Takes the pending call under the lock so a match and a
    /// timeout landing on different threads at the same moment cannot both win.
    private func finish(_ result: [String: Any]? = nil, reject: String? = nil, code: String? = nil) {
        lock.lock()
        let call = pendingCall
        pendingCall = nil
        let work = timeout
        timeout = nil
        lock.unlock()

        work?.cancel()
        stopAudio()

        guard let call else { return }
        call.keepAlive = false
        if let reject {
            call.reject(reject, code)
        } else {
            call.resolve(result ?? ["matched": false])
        }
    }

    private func requestMicrophone(_ done: @escaping (Bool) -> Void) {
        let reply: (Bool) -> Void = { granted in DispatchQueue.main.async { done(granted) } }
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: reply)
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission(reply)
        }
    }

    // MARK: - SHSessionDelegate

    public func session(_ session: SHSession, didFind match: SHMatch) {
        guard let item = match.mediaItems.first else {
            finish(["matched": false, "reason": "empty"])
            return
        }

        var result: [String: Any] = ["matched": true, "attempts": missesSoFar + 1]
        if let title = item.title { result["title"] = title }
        if let artist = item.artist { result["artist"] = artist }
        if let isrc = item.isrc { result["isrc"] = isrc }
        if let appleMusic = item.appleMusicURL { result["appleMusicUrl"] = appleMusic.absoluteString }
        if let artwork = item.artworkURL { result["artworkUrl"] = artwork.absoluteString }
        if let web = item.webURL { result["shazamUrl"] = web.absoluteString }
        if !item.genres.isEmpty { result["genres"] = item.genres }

        finish(result)
    }

    public func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: Error?) {
        // A real error ends the attempt: the network is gone, or the service
        // refused, and more audio will not change that.
        if let error {
            finish(["matched": false, "reason": "error", "detail": error.localizedDescription])
            return
        }
        // But "no match YET" does not, and treating it as final was the bug.
        //
        // With matchStreamingBuffer the session tries to match repeatedly as
        // the signature grows, and reports each failed try through this same
        // callback. Finishing on the first one cut listening off after a few
        // seconds - usually the intro, a quiet bar, or a crowd - which is the
        // least recognisable part of most songs. Found on a real iPhone, 11 Oct:
        // 3 of 5 tracks recognised, the misses among the ones with long
        // atmospheric openings. The window now runs to the timeout, as
        // Shazam's own app does, and only a match, an error or the timeout
        // ends it.
        missesSoFar += 1
    }
}

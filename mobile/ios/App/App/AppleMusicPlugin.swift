import Capacitor
import Foundation
import MusicKit

/// Adding a recognised track to the listener's own Apple Music library.
///
/// This is the one row where Shazam beat us and the gap was not structural.
/// Shazam writes into your Apple Music library; we handed you a LINK and left
/// the tap inside Apple Music to you. MusicKit closes that on iOS with the
/// developer programme already being paid for - no second subscription, no
/// per-user cap, no allowlist. Spotify has no equivalent and will not: its
/// development mode serves five authorised users and lifting that needs a
/// company with 250,000 monthly listeners.
///
/// It is deliberately SEPARATE from ShazamPlugin. Recognition works for
/// everyone; this works only for a person with an Apple Music subscription who
/// grants access. Wiring the second into the first would make a failure here
/// look like a failure to hear the song.
///
/// iOS 16 is the floor for MusicLibrary. The Capacitor project targets iOS 15,
/// so every entry point is guarded and simply reports unavailable below 16
/// rather than refusing to build.
@objc(AppleMusicPlugin)
public class AppleMusicPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "AppleMusicPlugin"
    public let jsName = "AppleMusic"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addByIsrc", returnType: CAPPluginReturnPromise)
    ]

    // MARK: - Availability and permission

    /// Never prompts. The page calls this to decide whether to offer the
    /// feature at all, and a permission dialog nobody asked for is the fastest
    /// way to have it refused for ever.
    @objc func status(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.resolve(["available": false, "reason": "ios15"])
            return
        }
        let s = MusicAuthorization.currentStatus
        call.resolve([
            "available": true,
            "authorized": s == .authorized,
            "status": String(describing: s)
        ])
    }

    @objc func authorize(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.resolve(["authorized": false, "reason": "ios15"])
            return
        }
        Task {
            let s = await MusicAuthorization.request()
            call.resolve(["authorized": s == .authorized, "status": String(describing: s)])
        }
    }

    // MARK: - Adding

    /// ISRC rather than a name, because that is the whole point of the
    /// pipeline: ShazamKit hands back an ISRC, Apple's catalogue is searchable
    /// by it, and the recording that comes back is THE recording rather than a
    /// cover, a remaster or a live take fifteen minutes long. Searching by name
    /// here would throw away the one identifier that makes this exact.
    @objc func addByIsrc(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.reject("Adding to Apple Music needs iOS 16 or later.", "ios15")
            return
        }
        guard let isrc = call.getString("isrc")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !isrc.isEmpty else {
            call.reject("No ISRC given", "input")
            return
        }

        Task {
            guard MusicAuthorization.currentStatus == .authorized else {
                call.reject("Apple Music access has not been granted.", "unauthorized")
                return
            }
            do {
                var request = MusicCatalogResourceRequest<Song>(matching: \.isrc, equalTo: isrc)
                request.limit = 1
                let response = try await request.response()

                guard let song = response.items.first else {
                    // Not an error: plenty of recordings are simply not in the
                    // Apple catalogue, and saying so is different from failing.
                    call.resolve(["added": false, "reason": "notInCatalog"])
                    return
                }

                try await MusicLibrary.shared.add(song)
                call.resolve([
                    "added": true,
                    "title": song.title,
                    "artist": song.artistName
                ])
            } catch {
                call.reject("Could not add to Apple Music: \(error.localizedDescription)", "add")
            }
        }
    }
}

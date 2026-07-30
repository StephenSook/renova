/// Read the answer aloud, in the device's own voice.
///
/// Same decision as the web app: the script is built from the deterministic
/// fields and the locked glossary (by the bridge, from the same buildScript
/// the web ships), never from model prose. Speech is harder to double-check
/// than text.
import AVFoundation

@MainActor
final class Speech: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
  @Published private(set) var speaking = false
  private let synthesizer = AVSpeechSynthesizer()

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  /// Latin American Spanish first, because that is who this is for.
  private func voice(for language: Language) -> AVSpeechSynthesisVoice? {
    let order = language == .es ? ["es-MX", "es-US", "es-419", "es-ES", "es"] : ["en-US", "en-GB", "en"]
    let voices = AVSpeechSynthesisVoice.speechVoices()
    for tag in order {
      if let hit = voices.first(where: { $0.language.lowercased().hasPrefix(tag.lowercased()) }) {
        return hit
      }
    }
    return nil
  }

  func speak(_ text: String, language: Language) {
    stop()
    let utterance = AVSpeechUtterance(string: text)
    if let voice = voice(for: language) { utterance.voice = voice }
    // Slightly under default. Read by people acting on it, not skimming.
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.92
    speaking = true
    synthesizer.speak(utterance)
  }

  func stop() {
    if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
    speaking = false
  }

  nonisolated func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance
  ) {
    Task { @MainActor in self.speaking = false }
  }

  nonisolated func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance
  ) {
    Task { @MainActor in self.speaking = false }
  }
}

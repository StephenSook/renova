/// The dark surface, condensed for a phone. The download is the argument:
/// this is the size of a language model moving onto your iPhone, natively,
/// where a browser tab could never hold it.
import SwiftUI

struct LandingView: View {
  @EnvironmentObject var state: AppState

  var body: some View {
    ZStack {
      Color(red: 0.05, green: 0.06, blue: 0.09).ignoresSafeArea()

      VStack(alignment: .leading, spacing: 20) {
        HStack {
          Text("Renova").font(.headline).foregroundStyle(.white)
          Spacer()
          Text(badge)
            .font(.footnote)
            .foregroundStyle(.white.opacity(0.7))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .overlay(Capsule().stroke(.white.opacity(0.25)))
        }

        Spacer()

        Text("MEDICAID RENEWAL, READ ON YOUR IPHONE")
          .font(.caption)
          .kerning(2)
          .foregroundStyle(.white.opacity(0.55))

        Text("Seven in ten kept their eligibility. They lost the envelope.")
          .font(.system(size: 34, weight: .bold))
          .foregroundStyle(.white)

        Text(
          "Photograph your renewal packet. Get the deadline, the case number, and exactly what to send, in plain English and Spanish. Nothing you photograph leaves this phone."
        )
        .font(.title3)
        .foregroundStyle(.white.opacity(0.7))

        gate

        Spacer()

        Text(
          "Decision support only. Not legal advice and not an eligibility determination. All demo documents are synthetic."
        )
        .font(.footnote)
        .foregroundStyle(.white.opacity(0.45))
      }
      .padding(24)
    }
  }

  private var badge: String {
    switch state.modelStatus {
    case .ready: return "Gemma 4 on this iPhone"
    case .downloading, .warming: return "Model arriving"
    default: return "Reader mode"
    }
  }

  @ViewBuilder private var gate: some View {
    switch state.modelStatus {
    case .tooSmall:
      /* Same honesty as the web gate: say it before a byte moves. */
      VStack(alignment: .leading, spacing: 12) {
        Text(
          "This iPhone caps app memory below what the 2.6 GB model needs, so the written explanation runs on laptops and newer iPhones. The deadline, the case number, and the checklist are read on this iPhone, and the sample packets show the full experience."
        )
        .font(.body)
        .foregroundStyle(.white.opacity(0.7))
        Button {
          state.screen = .capture
        } label: {
          Text("Read my packet anyway")
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 56)
        }
        .buttonStyle(.borderedProminent)
        .tint(.white)
        .foregroundStyle(.black)
      }
    case .absent, .failed:
      VStack(alignment: .leading, spacing: 12) {
        if case .failed(let message) = state.modelStatus {
          Text(message).font(.footnote).foregroundStyle(.orange)
        }
        Button {
          state.startDownload()
        } label: {
          Text("Put Gemma 4 on this iPhone")
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 56)
        }
        .buttonStyle(.borderedProminent)
        .tint(.yellow)
        .foregroundStyle(.black)

        Text("2.59 GB, once. Wifi recommended. Or skip it and use the reader without the written explanation.")
          .font(.footnote)
          .foregroundStyle(.white.opacity(0.5))

        Button("Skip and read my packet") { state.screen = .capture }
          .font(.subheadline)
          .foregroundStyle(.white.opacity(0.7))
          .underline()
          .frame(minHeight: 44)
      }
    case .downloading(let fraction):
      VStack(alignment: .leading, spacing: 10) {
        Text("\(Int(fraction * 100))%")
          .font(.system(size: 72, weight: .bold))
          .foregroundStyle(.white)
          .monospacedDigit()
        ProgressView(value: fraction).tint(.yellow)
        Text(
          "Gemma 4 E2B is copying onto your iPhone. This happens once. After it finishes, nothing you photograph is ever transmitted anywhere."
        )
        .font(.footnote)
        .foregroundStyle(.white.opacity(0.6))
        Button("Use the reader while it downloads") { state.screen = .capture }
          .font(.subheadline)
          .foregroundStyle(.white.opacity(0.7))
          .underline()
          .frame(minHeight: 44)
      }
    case .warming:
      VStack(alignment: .leading, spacing: 12) {
        ProgressView().tint(.white)
        Text("Loading Gemma 4 onto the GPU...").font(.body).foregroundStyle(.white.opacity(0.8))
        Button("Use the reader while it loads") { state.screen = .capture }
          .font(.subheadline)
          .foregroundStyle(.white.opacity(0.7))
          .underline()
          .frame(minHeight: 44)
      }
    case .ready:
      VStack(alignment: .leading, spacing: 12) {
        Text("Gemma 4 is on this iPhone. You can turn on Airplane Mode.")
          .font(.body)
          .foregroundStyle(.yellow)
        Button {
          state.screen = .capture
        } label: {
          Text("Read my packet")
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 56)
        }
        .buttonStyle(.borderedProminent)
        .tint(.white)
        .foregroundStyle(.black)
      }
    }
  }
}

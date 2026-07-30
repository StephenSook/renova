import SwiftUI

@main
struct RenovaApp: App {
  @StateObject private var state = AppState()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(state)
    }
  }
}

struct RootView: View {
  @EnvironmentObject var state: AppState

  var body: some View {
    if let loadError = state.rulesLoadError {
      // The engine bundle missing is a build defect. Never pretend to work.
      VStack(spacing: 12) {
        Text("Renova cannot start").font(.title2.bold())
        Text(loadError).font(.body).foregroundStyle(.secondary)
      }
      .padding()
    } else {
      switch state.screen {
      case .landing: LandingView()
      case .capture: CaptureView()
      case .working: WorkingView()
      case .result:
        if state.result != nil {
          ResultView()
        } else {
          CaptureView()
        }
      }
    }
  }
}

struct WorkingView: View {
  @EnvironmentObject var state: AppState

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Spacer()
      Text(state.stageMessage.isEmpty ? "Working..." : state.stageMessage)
        .font(.title.bold())
      Text("This is happening on your iPhone. Nothing is being uploaded.")
        .font(.title3)
        .foregroundStyle(.secondary)
      Spacer()
    }
    .padding(24)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

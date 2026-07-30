/// Photograph your packet, or try a sample. Mirrors the web capture screen.
import PhotosUI
import SwiftUI

struct CaptureView: View {
  @EnvironmentObject var state: AppState
  @State private var showScanner = false
  @State private var pickedItems: [PhotosPickerItem] = []

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        Text("Photograph your packet")
          .font(.largeTitle.bold())
          .padding(.top, 24)

        Text(
          "Scan every page you have, including the cover notice that came with it. The deadline is often on the notice rather than on the form."
        )
        .font(.title3)
        .foregroundStyle(.secondary)

        Button {
          showScanner = true
        } label: {
          Text("Scan my packet")
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 60)
        }
        .buttonStyle(.borderedProminent)

        PhotosPicker(selection: $pickedItems, maxSelectionCount: 8, matching: .images) {
          Text("Choose photos I already took")
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 56)
        }
        .buttonStyle(.bordered)

        Text(statusLine)
          .font(.body)
          .foregroundStyle(.secondary)

        if let error = state.errorMessage {
          Text(error)
            .font(.body)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.red.opacity(0.1))
            .overlay(Rectangle().frame(width: 4).foregroundStyle(.red), alignment: .leading)
        }

        Divider().padding(.vertical, 8)

        Text("NO PACKET IN FRONT OF YOU? TRY A SAMPLE")
          .font(.footnote.bold())
          .kerning(1)
          .foregroundStyle(.secondary)

        Text("Synthetic documents in the states' real formats. Invented values, nobody's mail.")
          .font(.subheadline)
          .foregroundStyle(.secondary)

        ForEach(demoScenarios) { scenario in
          Button {
            state.runDemo(scenario)
          } label: {
            VStack(alignment: .leading, spacing: 4) {
              Text(scenario.label).font(.headline)
              Text(scenario.description).font(.subheadline).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .overlay(
              RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.4))
            )
          }
          .buttonStyle(.plain)
        }
      }
      .padding(20)
    }
    .sheet(isPresented: $showScanner) {
      ScannerView { images in
        guard !images.isEmpty else { return }
        state.run(images: images)
      }
      .ignoresSafeArea()
    }
    .onChange(of: pickedItems) { _, items in
      guard !items.isEmpty else { return }
      Task {
        var images: [CGImage] = []
        for item in items {
          if let data = try? await item.loadTransferable(type: Data.self),
            let ui = UIImage(data: data), let cg = ui.cgImage
          {
            images.append(cg)
          }
        }
        pickedItems = []
        if images.isEmpty {
          state.errorMessage =
            "Those photos could not be loaded. Try again, or scan the packet instead."
        } else {
          state.run(images: images)
        }
      }
    }
  }

  private var statusLine: String {
    switch state.modelStatus {
    case .ready:
      return "Gemma 4 is loaded on this iPhone. You can turn on Airplane Mode now."
    case .downloading(let f):
      return "Gemma 4 is still arriving (\(Int(f * 100))%). You can start now; the explanation appears once it is ready."
    case .warming:
      return "Gemma 4 is loading. You can start now; the explanation appears if it is ready."
    default:
      return "Running without the written explanation. Your deadline, case number, and checklist still work."
    }
  }
}

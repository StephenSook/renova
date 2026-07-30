/// The document camera, which is the right capture tool for paper: edge
/// detection, perspective correction, multi-page in one pass.
import SwiftUI
import VisionKit

struct ScannerView: UIViewControllerRepresentable {
  let onFinish: ([CGImage]) -> Void
  @Environment(\.dismiss) private var dismiss

  func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
    let controller = VNDocumentCameraViewController()
    controller.delegate = context.coordinator
    return controller
  }

  func updateUIViewController(_ controller: VNDocumentCameraViewController, context: Context) {}

  func makeCoordinator() -> Coordinator { Coordinator(self) }

  final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
    let parent: ScannerView
    init(_ parent: ScannerView) { self.parent = parent }

    func documentCameraViewController(
      _ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan
    ) {
      var images: [CGImage] = []
      for index in 0..<scan.pageCount {
        if let cg = scan.imageOfPage(at: index).cgImage { images.append(cg) }
      }
      parent.dismiss()
      parent.onFinish(images)
    }

    func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
      parent.dismiss()
    }

    func documentCameraViewController(
      _ controller: VNDocumentCameraViewController, didFailWithError error: Error
    ) {
      parent.dismiss()
    }
  }
}

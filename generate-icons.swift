import AppKit
import Foundation
import WebKit

final class SnapshotDelegate: NSObject, WKNavigationDelegate {
  let webView: WKWebView
  let outputURL: URL
  let size: CGSize

  init(webView: WKWebView, outputURL: URL, size: CGSize) {
    self.webView = webView
    self.outputURL = outputURL
    self.size = size
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
      let config = WKSnapshotConfiguration()
      config.rect = CGRect(origin: .zero, size: self.size)
      config.snapshotWidth = NSNumber(value: Double(self.size.width))

      webView.takeSnapshot(with: config) { image, error in
        guard error == nil, let image else {
          fputs("Failed to snapshot icon: \(error?.localizedDescription ?? "unknown error")\n", stderr)
          NSApp.terminate(nil)
          return
        }

        guard
          let tiffData = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiffData),
          let pngData = bitmap.representation(using: .png, properties: [:])
        else {
          fputs("Failed to encode PNG output.\n", stderr)
          NSApp.terminate(nil)
          return
        }

        do {
          try pngData.write(to: self.outputURL)
          print("Wrote \(self.outputURL.path)")
          NSApp.terminate(nil)
        } catch {
          fputs("Failed to write PNG: \(error.localizedDescription)\n", stderr)
          NSApp.terminate(nil)
        }
      }
    }
  }
}

let args = CommandLine.arguments
guard args.count == 3 else {
  fputs("Usage: swift generate-icons.swift <input-svg> <output-png>\n", stderr)
  exit(1)
}

let inputURL = URL(fileURLWithPath: args[1])
let outputURL = URL(fileURLWithPath: args[2])
let size = CGSize(width: 180, height: 180)

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

let webView = WKWebView(frame: CGRect(origin: .zero, size: size))
let delegate = SnapshotDelegate(webView: webView, outputURL: outputURL, size: size)
webView.navigationDelegate = delegate
_ = webView.loadFileURL(inputURL, allowingReadAccessTo: inputURL.deletingLastPathComponent())

app.run()

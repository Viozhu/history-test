// Korean OCR via Apple Vision. Usage: ocr <image.png> [<image.png> ...]
// Prints one JSON object per image: {"file":..., "width":W, "height":H, "lines":[{"text":..., "conf":c, "bbox":[x0,y0,x1,y1]}]}
// bbox is in image pixels with a top-left origin.
import AppKit
import Foundation
import Vision

func ocr(_ path: String) throws -> [String: Any] {
    guard let img = NSImage(contentsOfFile: path) else {
        throw NSError(domain: "ocr", code: 1, userInfo: [NSLocalizedDescriptionKey: "cannot open \(path)"])
    }
    var rect = CGRect.zero
    guard let cg = img.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        throw NSError(domain: "ocr", code: 2, userInfo: [NSLocalizedDescriptionKey: "no cgImage for \(path)"])
    }
    let w = Double(cg.width), h = Double(cg.height)
    let req = VNRecognizeTextRequest()
    req.recognitionLanguages = ["ko-KR", "en-US"]
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = true
    try VNImageRequestHandler(cgImage: cg).perform([req])
    var lines: [[String: Any]] = []
    for o in req.results ?? [] {
        guard let c = o.topCandidates(1).first else { continue }
        let b = o.boundingBox  // normalized, bottom-left origin
        lines.append([
            "text": c.string,
            "conf": Double(c.confidence),
            "bbox": [b.minX * w, (1 - b.maxY) * h, b.maxX * w, (1 - b.minY) * h],
        ])
    }
    return ["file": path, "width": w, "height": h, "lines": lines]
}

for path in CommandLine.arguments.dropFirst() {
    do {
        let data = try JSONSerialization.data(withJSONObject: try ocr(path), options: [])
        print(String(data: data, encoding: .utf8)!)
    } catch {
        FileHandle.standardError.write("error: \(error.localizedDescription)\n".data(using: .utf8)!)
        exit(1)
    }
}

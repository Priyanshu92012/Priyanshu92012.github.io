import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
guard let ci = CIImage(contentsOf: input) else { fatalError("cannot read") }
let handler = VNImageRequestHandler(ciImage: ci, options: [:])

// Prefer the instance-mask request (macOS 14+): better hair edges at full resolution.
let req = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([req])
guard let obs = req.results?.first else { fatalError("no result") }
let buf = try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler)
let mask = CIImage(cvPixelBuffer: buf)
let ctx = CIContext()
let gray = mask.applyingFilter("CIColorControls", parameters: [:])
guard let cg = ctx.createCGImage(gray, from: gray.extent) else { fatalError("cg") }
let rep = NSBitmapImageRep(cgImage: cg)
let png = rep.representation(using: .png, properties: [:])!
try png.write(to: output)
print("mask", cg.width, cg.height)

// This pinned ORT release declares its types but omits them from package exports.
declare module "onnxruntime-web" {
  export { env, InferenceSession, Tensor } from "onnxruntime-common";
}

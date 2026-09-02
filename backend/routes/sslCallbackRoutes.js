import { Router } from "express";
import { bindSslHandlers } from "../controllers/sslPaymentController.js";

export default function createSslCallbackRoutes(environment = process.env) {
  const router = Router();
  const ssl = bindSslHandlers(environment);
  for (const name of ["success", "fail", "cancel", "ipn"]) {
    router.post(`/${name}`, ssl[name]);
    router.get(`/${name}`, ssl[name]);
  }
  return router;
}

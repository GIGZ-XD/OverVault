import { http, HttpResponse } from "msw";
import files from "../../../specs/fixtures/files.json";

export const handlers = [
  http.get("*/files", () => HttpResponse.json(files)),
];

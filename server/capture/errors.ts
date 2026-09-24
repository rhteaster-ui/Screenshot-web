export class CaptureError extends Error {
  constructor(public code: string, message: string, public status = 400, public row?: number) { super(message); }
}

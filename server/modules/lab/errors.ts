/** A request problem with the HTTP status the API should answer with. */
export class LabError extends Error {
  constructor(
    readonly statusCode: 400 | 404,
    message: string,
  ) {
    super(message)
  }
}

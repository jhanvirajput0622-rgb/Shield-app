import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";

/**
 * Express middleware factory that validates req against a Zod schema.
 * The schema should have keys "body", "query", "params" as needed.
 *
 * On success: passes control to next handler with parsed (coerced) values.
 * On failure: calls next(ZodError) — caught by the central errorHandler.
 */
export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Replace with coerced/defaulted values from Zod
      req.body = parsed.body ?? req.body;
      req.query = parsed.query ?? req.query;
      req.params = parsed.params ?? req.params;
      next();
    } catch (err) {
      next(err); // ZodError — handled by errorHandler
    }
  };
}

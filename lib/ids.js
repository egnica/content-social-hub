import { ObjectId } from "mongodb";

export function toObjectId(value) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

export function serializeDocument(document) {
  if (!document) {
    return null;
  }

  return JSON.parse(JSON.stringify(document));
}

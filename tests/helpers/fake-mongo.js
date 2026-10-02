const equal = (left, right) =>
  (left == null && right == null) || String(left) === String(right);

export function matches(document, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") return expected.some((part) => matches(document, part));
    if (key === "$and")
      return expected.every((part) => matches(document, part));
    const actual = document[key];
    if (
      expected &&
      typeof expected === "object" &&
      !(expected instanceof Date)
    ) {
      return Object.entries(expected).every(([op, value]) => {
        if (op === "$lte") return actual != null && actual <= value;
        if (op === "$gt") return actual > value;
        if (op === "$ne") return !equal(actual, value);
        if (op === "$in") return value.some((item) => equal(actual, item));
        return false;
      });
    }
    return equal(actual, expected);
  });
}

export function fakeCollection(documents = []) {
  const writes = [];
  const apply = (filter, update) => {
    const doc = documents.find((item) => matches(item, filter));
    writes.push({ filter, update, matched: Boolean(doc) });
    if (!doc) return null;
    Object.assign(doc, update.$set || {});
    for (const key of Object.keys(update.$unset || {})) delete doc[key];
    for (const [key, value] of Object.entries(update.$push || {}))
      (doc[key] ||= []).push(value);
    return structuredClone(doc);
  };
  return {
    documents,
    writes,
    createIndex: async () => "index",
    findOne: async (filter) =>
      structuredClone(documents.find((item) => matches(item, filter)) || null),
    findOneAndUpdate: async (filter, update) => apply(filter, update),
    updateOne: async (filter, update) => ({
      matchedCount: apply(filter, update) ? 1 : 0,
    }),
    find(filter) {
      let found = documents.filter((item) => matches(item, filter));
      return {
        sort(spec) {
          const [key, order] = Object.entries(spec)[0];
          found.sort(
            (a, b) => order * ((a[key] || 0) > (b[key] || 0) ? 1 : -1),
          );
          return this;
        },
        limit(limit) {
          found = found.slice(0, limit);
          return this;
        },
        async toArray() {
          return structuredClone(found);
        },
      };
    },
  };
}

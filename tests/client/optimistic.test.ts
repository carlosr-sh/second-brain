import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { paraKeys, patchListCaches } from "@/features/para/queries";

it("optimistic patch updates list caches and tolerates non-array entries (regression)", () => {
  const qc = new QueryClient();
  qc.setQueryData(paraKeys.tasks({}), [{ id: "a", title: "A" }, { id: "b", title: "B" }]);
  qc.setQueryData(["para", "tasks", { odd: "1" }, "single"], { id: "a", title: "A" }); // non-array under the same prefix
  const rollback = patchListCaches<{ id: string; title: string }>(qc, ["para", "tasks"], { id: "a", title: "A2" });
  expect(qc.getQueryData(paraKeys.tasks({}))).toEqual([{ id: "a", title: "A2" }, { id: "b", title: "B" }]);
  expect(qc.getQueryData(["para", "tasks", { odd: "1" }, "single"])).toEqual({ id: "a", title: "A" });
  rollback();
  expect(qc.getQueryData(paraKeys.tasks({}))).toEqual([{ id: "a", title: "A" }, { id: "b", title: "B" }]);
});

it("single-task query key is outside the list prefix", () => {
  expect(paraKeys.task("x").slice(0, 2)).not.toEqual(["para", "tasks"]);
});

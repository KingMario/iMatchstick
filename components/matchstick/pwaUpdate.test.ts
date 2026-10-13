import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activateWorker,
  isNewerBuild,
  refreshWorker,
  waitForWorker,
  withTimeout,
  workerBuildId,
} from "./pwaUpdate";
class Worker extends EventTarget {
  state: ServiceWorkerState = "installed";
  messages: unknown[] = [];
  postMessage(data: unknown, ports?: MessagePort[]) {
    this.messages.push(data);
    if (ports) ports[0].postMessage("20261013.10");
    else {
      this.state = "activated";
      this.dispatchEvent(new Event("statechange"));
    }
  }
  asWorker() {
    return this as unknown as ServiceWorker;
  }
}
test("only newer numeric build or retry is an update", () => {
  assert.equal(isNewerBuild("20261013.09", "20261013.10"), false);
  assert.equal(isNewerBuild("20261013.10", "20261013.09"), true);
  assert.equal(isNewerBuild("20261013.100", "20261013.99"), true);
  assert.equal(isNewerBuild("20261013.10", "20261013.10"), false);
  assert.equal(isNewerBuild("20261013.10-r2", "20261013.10"), true);
  assert.equal(isNewerBuild("20261013.10", "20261013.10-r2"), false);
});
test("hung network operations time out and can be retried", async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 5), /timed out/);
  assert.equal(await withTimeout(Promise.resolve("retry")), "retry");
  await assert.rejects(
    withTimeout(Promise.reject(new Error("offline"))),
    /offline/,
  );
});
test("activation subscribes before message and needs no controllerchange", async () => {
  const worker = new Worker();
  await activateWorker(worker.asWorker());
  assert.deepEqual(worker.messages, [{ type: "ACTIVATE_UPDATE" }]);
});
test("already activated worker resolves and redundant installation fails", async () => {
  const worker = new Worker();
  worker.state = "activated";
  await waitForWorker(worker.asWorker(), true);
  worker.state = "redundant";
  await assert.rejects(waitForWorker(worker.asWorker()), /failed/);
});
test("worker version messaging closes and resolves", async () => {
  assert.equal(await workerBuildId(new Worker().asWorker()), "20261013.10");
});
test("update waits for slow installation and returns waiting worker", async () => {
  const worker = new Worker();
  worker.state = "installing";
  const reg = {
    update: async () => {},
    installing: worker.asWorker(),
    waiting: null as ServiceWorker | null,
    active: null,
  };
  const result = refreshWorker(reg as unknown as ServiceWorkerRegistration);
  setTimeout(() => {
    worker.state = "installed";
    reg.waiting = worker.asWorker();
    worker.dispatchEvent(new Event("statechange"));
  }, 5);
  assert.equal(await result, worker);
});
test("no waiting worker returns active worker and update failures propagate", async () => {
  const worker = new Worker();
  worker.state = "activated";
  const reg = {
    update: async () => {},
    installing: null,
    waiting: null,
    active: worker.asWorker(),
  };
  assert.equal(
    await refreshWorker(reg as unknown as ServiceWorkerRegistration),
    worker,
  );
  reg.update = async () => {
    throw new Error("404");
  };
  await assert.rejects(
    refreshWorker(reg as unknown as ServiceWorkerRegistration),
    /404/,
  );
});
test("missing activation and slow install fail with a bounded retry path", async () => {
  const worker = new Worker();
  await assert.rejects(waitForWorker(worker.asWorker(), true, 5), /timed out/);
  worker.state = "installing";
  await assert.rejects(waitForWorker(worker.asWorker(), false, 5), /timed out/);
  worker.state = "installed";
  await activateWorker(worker.asWorker());
});
test("duplicate state changes resolve a single activation", async () => {
  const worker = new Worker();
  let resolutions = 0;
  const ready = waitForWorker(worker.asWorker(), true).then(() => {
    resolutions++;
  });
  worker.state = "activated";
  worker.dispatchEvent(new Event("statechange"));
  worker.dispatchEvent(new Event("statechange"));
  await ready;
  assert.equal(resolutions, 1);
});

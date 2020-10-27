import {assert} from "chai";
import {FireStorm, FireStormSchema, registerSchema} from "./index";
import "mocha";
import nativeAssert from "assert";
import sinon from "sinon";

function getFireStormMock(): any {
  return {
    saveDocument: sinon.stub(),
    updateDocument: sinon.stub(),
    deleteDocument: sinon.stub(),
  };
}

describe("FireStormSchema", function() {
  it("create a schema", async function() {
    const schema = new FireStormSchema("Model", {
      string: String,
      number: Number,
      boolean: Boolean,
      array: Array,
      object: Object,
      date: Date,
    });
    const Model = registerSchema("Model", schema);
    const m = new Model({
      string: "test",
      number: 1,
      boolean: true,
      array: [1, 2, 3],
      object: {
        b: "b",
        a: 1,
        c: true,
      },
      date: new Date("2020-01-01"),
    });

    let n = m as any;
    assert.equal(n.string, "test");
    assert.equal(n.number, 1);
    assert.equal(n.boolean, true);
    assert.deepEqual(n.array, [1, 2, 3]);
    assert.deepEqual(n.object, {b: "b", a: 1, c: true});
    assert.equal(n.date.toISOString(), "2020-01-01T00:00:00.000Z");
    await n.validate();
  });

  it("fails to create an instance with an unknown property", function() {
    const schema = new FireStormSchema("Model", {
      string: String,
    });
    const Model = registerSchema("Model", schema);
    assert.throws(() => new Model({string: "string", nope: "not a chance"}));
  });

  it("non string fails validation", async function() {
    const schema = new FireStormSchema("Model", {
      field: String,
    });
    const Model = registerSchema("Model", schema);
    let m = new Model({field: 1});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: true});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: {}});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: []});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: new Date()});
    await nativeAssert.rejects(async () => await m.validate());
  });

  it("non number fails validation", async function() {
    const schema = new FireStormSchema("Model", {
      field: Number,
    });
    const Model = registerSchema("Model", schema);
    let m = new Model({field: "string"});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: true});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: {}});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: []});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: new Date()});
    await nativeAssert.rejects(async () => await m.validate());
  });

  it("non boolean fails validation", async function() {
    const schema = new FireStormSchema("Model", {
      field: Boolean,
    });
    const Model = registerSchema("Model", schema);
    let m = new Model({field: 1});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: "string"});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: {}});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: []});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: new Date()});
    await nativeAssert.rejects(async () => await m.validate());
  });

  it("non array fails validation", async function() {
    const schema = new FireStormSchema("Model", {
      field: Array,
    });
    const Model = registerSchema("Model", schema);
    let m = new Model({field: 1});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: true});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: {}});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: "string"});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: new Date()});
    await nativeAssert.rejects(async () => await m.validate());
  });

  it("non date fails validation", async function() {
    const schema = new FireStormSchema("Model", {
      field: Date,
    });
    const Model = registerSchema("Model", schema);
    let m = new Model({field: 1});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: true});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: {}});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: []});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: "string"});
    await nativeAssert.rejects(async () => await m.validate());
  });

  it("non object fails validation", async function() {
    const schema = new FireStormSchema("Model", {
      field: Object,
    });
    const Model = registerSchema("Model", schema);
    let m = new Model({field: 1});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: true});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: "string"});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: []});
    await nativeAssert.rejects(async () => await m.validate());
    m = new Model({field: new Date()});
    await nativeAssert.rejects(async () => await m.validate());
  });

  it("create and save an instance", async function() {
    const fsMock = getFireStormMock();
    const schema = new FireStormSchema(
      "Model",
      {
        field: Number,
      },
      fsMock
    );
    const Model = registerSchema("Model", schema);
    let m = new Model({field: 1});
    await m.save();

    assert.equal((m as any).field, 1);
    assert.isTrue(fsMock.saveDocument.calledOnceWith("Model", {id: m.id, field: 1}));
  });

  it("update an instance", async function() {
    const fsMock = getFireStormMock();
    const schema = new FireStormSchema(
      "Model",
      {
        field: Number,
      },
      fsMock
    );
    const Model = registerSchema("Model", schema);
    let m = new Model({field: 1});
    await m.save();
    await m.update({field: 2});

    assert.equal((m as any).field, 2);
    assert.isTrue(fsMock.updateDocument.calledOnceWith("Model", m.id, {field: 2}));
  });

  it("fails to create a bad instance", async function() {
    const fsMock = getFireStormMock();
    const schema = new FireStormSchema(
      "Model",
      {
        field: Number,
      },
      fsMock
    );
    const Model = registerSchema("Model", schema);
    let m = new Model({field: 1});
    await m.save();

    (m as any).field = "two";
    nativeAssert.rejects(m.save());
  });
});

import { describe, it, expect } from "vitest";
import { KanbanCore } from "./kanban-core";

const SAMPLE = [
  "# To Do",
  "- [ ] Write a brief",
  "- [ ] Review the design",
  "  This is a body line for the second card.",
  "- [ ] Schedule meeting {start:2026-09-01}",
  "",
  "## In Progress",
  "- [ ] Build the prototype",
  "  Multiline body",
  "  with two lines",
  "- [x] Spike on parser <!-- {\"uuid\":\"abc-123\",\"completedAt\":1700000000} -->",
  "",
  "## Done",
  "- [x] Initial scaffold",
].join("\n");

describe("KanbanCore.parseBoard", () => {
  it("parses standard markdown with headings and tasks", () => {
    const board = KanbanCore.parseBoard(SAMPLE);
    expect(board.columns.length).toBe(3);
    expect(board.columns[0].title).toBe("To Do");
    expect(board.columns[0].tasks.length).toBe(3);
    expect(board.columns[0].tasks[0].text).toBe("Write a brief");
    expect(board.columns[0].tasks[0].checked).toBe(false);
    expect(board.columns[0].tasks[2].startDate).toBe("2026-09-01");
    expect(board.columns[1].title).toBe("In Progress");
    expect(board.columns[2].tasks[0].text).toBe("Initial scaffold");
    expect(board.columns[2].tasks[0].checked).toBe(true);
  });

  it("handles markdown with no headings (implicit backlog)", () => {
    const board = KanbanCore.parseBoard("- [ ] A\n- [x] B\n");
    expect(board.columns.length).toBe(1);
    expect(board.columns[0].title).toBe(KanbanCore.NO_HEADING_TITLE);
    expect(board.columns[0].tasks.length).toBe(2);
  });

  it("parses multi-line card body until next task or heading", () => {
    const md = "# Col\n- [ ] First\n  body line 1\n  body line 2\n\n- [ ] Second\n";
    const board = KanbanCore.parseBoard(md);
    expect(board.columns[0].tasks[0].body).toContain("body line 1");
    expect(board.columns[0].tasks[0].body).toContain("body line 2");
    expect(board.columns[0].tasks[1].text).toBe("Second");
  });

  it("extracts hidden UUID metadata and uses it as the card id", () => {
    const md = "# T\n- [ ] Hi <!-- {\"uuid\":\"abc-123\"} -->\n";
    const board = KanbanCore.parseBoard(md);
    expect(board.columns[0].tasks[0].id).toBe("abc-123");
    expect(board.columns[0].tasks[0].meta).toEqual({ uuid: "abc-123" });
  });

  it("extracts the first image in text+body", () => {
    const md = "# T\n- [ ] Hello\n  ![a](https://x.test/img.png)\n";
    const board = KanbanCore.parseBoard(md);
    expect(board.columns[0].tasks[0].firstImage).toEqual({ alt: "a", url: "https://x.test/img.png" });
  });

  it("extracts bare and markdown URLs", () => {
    const md = "# T\n- [ ] See [home](https://home.test) and https://bare.test/path\n";
    const board = KanbanCore.parseBoard(md);
    const urls = KanbanCore.extractUrls(board.columns[0].tasks[0]);
    expect(urls).toContain("https://home.test");
    expect(urls).toContain("https://bare.test/path");
  });
});

describe("KanbanCore.mutators", () => {
  it("moveCardToIndex moves a card across columns at the requested index", () => {
    const next = KanbanCore.moveCardToIndex(SAMPLE, {
      cardText: "Write a brief",
      fromColumn: "To Do",
      toColumn: "In Progress",
      toIndex: 0,
    });
    const board = KanbanCore.parseBoard(next);
    expect(board.columns[0].tasks.find((t) => t.text === "Write a brief")).toBeUndefined();
    expect(board.columns[1].tasks[0].text).toBe("Write a brief");
  });

  it("moveCardToIndex marks the card complete when markComplete is true", () => {
    const next = KanbanCore.moveCardToIndex(SAMPLE, {
      cardText: "Write a brief",
      fromColumn: "To Do",
      toColumn: "Done",
      toIndex: 0,
      markComplete: true,
    });
    const board = KanbanCore.parseBoard(next);
    const moved = board.columns[2].tasks.find((t) => t.text === "Write a brief");
    expect(moved).toBeDefined();
    expect(moved!.checked).toBe(true);
  });

  it("moveCardToIndex adjusts the destination index when removing from the same column shifts the list", () => {
    const next = KanbanCore.moveCardToIndex(SAMPLE, {
      cardText: "Build the prototype",
      fromColumn: "In Progress",
      toColumn: "In Progress",
      toIndex: 5,
    });
    const board = KanbanCore.parseBoard(next);
    expect(board.columns[1].tasks.map((t) => t.text)).toEqual([
      "Spike on parser",
      "Build the prototype",
    ]);
  });

  it("moveCardToIndex preserves the implicit (No heading) backlog when sourceColumn is null", () => {
    const md = "- [ ] Orphan 1\n- [ ] Orphan 2\n\n# Inbox\n- [ ] Hello\n";
    const next = KanbanCore.moveCardToIndex(md, {
      cardText: "Hello",
      fromColumn: "Inbox",
      toColumn: "",
      toIndex: 0,
    });
    const board = KanbanCore.parseBoard(next);
    expect(board.columns[0].title).toBe(KanbanCore.NO_HEADING_TITLE);
    expect(board.columns[0].tasks[0].text).toBe("Hello");
  });

  it("addCard appends a task to the end of the named column", () => {
    const next = KanbanCore.addCard(SAMPLE, {
      columnTitle: "To Do",
      text: "Brand new card",
    });
    const board = KanbanCore.parseBoard(next);
    expect(board.columns[0].tasks[board.columns[0].tasks.length - 1].text).toBe("Brand new card");
  });

  it("addCard with a start date round-trips", () => {
    const next = KanbanCore.addCard(SAMPLE, {
      columnTitle: "To Do",
      text: "With date",
      startDate: "2026-12-01",
    });
    const board = KanbanCore.parseBoard(next);
    const added = board.columns[0].tasks[board.columns[0].tasks.length - 1];
    expect(added.startDate).toBe("2026-12-01");
    expect(added.text).toBe("With date");
  });

  it("editCard replaces task text and body without losing its position", () => {
    const next = KanbanCore.editCard(SAMPLE, {
      columnTitle: "In Progress",
      oldText: "Build the prototype",
      newMarkdown: "- [ ] Build the polished prototype\n  new line one\n  new line two",
    });
    const board = KanbanCore.parseBoard(next);
    const card = board.columns[1].tasks.find((t) => t.text.startsWith("Build the polished prototype"));
    expect(card).toBeDefined();
    expect(card!.body).toContain("new line one");
    expect(card!.body).toContain("new line two");
  });

  it("editCard keeps the completion state, start date and hidden metadata", () => {
    const md = [
      "# To Do",
      "- [x] Ship it {start:2026-09-01} <!-- {\"uuid\":\"abc-123\",\"completedAt\":1700000000} -->",
    ].join("\n");
    const next = KanbanCore.editCard(md, {
      columnTitle: "To Do",
      oldText: "Ship it",
      newMarkdown: "Ship it twice\n  with a body",
    });
    const card = KanbanCore.parseBoard(next).columns[0].tasks[0];
    expect(card.text).toBe("Ship it twice");
    expect(card.checked).toBe(true);
    expect(card.startDate).toBe("2026-09-01");
    expect(card.meta).toEqual({ uuid: "abc-123", completedAt: 1700000000 });
    expect(card.body).toContain("with a body");
  });

  it("editCard honours a checkbox the user typed themselves", () => {
    const next = KanbanCore.editCard(SAMPLE, {
      columnTitle: "To Do",
      oldText: "Write a brief",
      newMarkdown: "- [x] Write a brief",
    });
    const card = KanbanCore.parseBoard(next).columns[0].tasks[0];
    expect(card.checked).toBe(true);
  });

  it("addCard appends to the implicit backlog when the column title is blank", () => {
    const next = KanbanCore.addCard("- [ ] Orphan\n\n# Inbox\n- [ ] Hello\n", {
      columnTitle: "",
      text: "Another orphan",
    });
    const board = KanbanCore.parseBoard(next);
    expect(board.columns[0].title).toBe(KanbanCore.NO_HEADING_TITLE);
    expect(board.columns[0].tasks.map((t: { text: string }) => t.text)).toEqual(["Orphan", "Another orphan"]);
  });

  it("mutates columns whose heading carries a [n] card limit", () => {
    const md = "## To Do [2]\n- [ ] One\n";
    const added = KanbanCore.addCard(md, { columnTitle: "To Do [2]", text: "Two" });
    expect(KanbanCore.parseBoard(added).columns[0].tasks.length).toBe(2);
    const renamed = KanbanCore.renameColumn(added, { oldTitle: "To Do [2]", newTitle: "Doing [2]" });
    expect(KanbanCore.parseBoard(renamed).columns[0].title).toBe("Doing [2]");
    const deleted = KanbanCore.deleteColumn(renamed, { title: "Doing [2]" });
    expect(KanbanCore.parseBoard(deleted).columns[0].title).toBe(KanbanCore.NO_HEADING_TITLE);
  });

  it("moveCardToIndex reorders inside a column even when marking complete", () => {
    const md = "# Done\n- [ ] First\n- [ ] Second\n";
    const next = KanbanCore.moveCardToIndex(md, {
      cardText: "First",
      fromColumn: "Done",
      toColumn: "Done",
      toIndex: 2,
      markComplete: true,
    });
    const tasks = KanbanCore.parseBoard(next).columns[0].tasks;
    expect(tasks.map((t: { text: string }) => t.text)).toEqual(["Second", "First"]);
    expect(tasks[1].checked).toBe(true);
  });

  it("setCardStartDate and tagCardWithNote keep the metadata comment trailing", () => {
    const md = "# To Do\n- [x] Done thing <!-- {\"uuid\":\"u-1\"} -->\n";
    const dated = KanbanCore.setCardStartDate(md, {
      columnTitle: "To Do",
      cardText: "Done thing",
      date: "2027-03-04",
    });
    expect(dated).toContain('{start:2027-03-04} <!-- {"uuid":"u-1"} -->');
    const tagged = KanbanCore.tagCardWithNote(dated, {
      columnTitle: "To Do",
      cardText: "Done thing",
      noteName: "Ref",
      noteUUID: "uuid-9",
    });
    expect(tagged).toContain('(https://www.amplenote.com/notes/uuid-9) <!-- {"uuid":"u-1"} -->');
    expect(KanbanCore.parseBoard(tagged).columns[0].tasks[0].meta).toEqual({ uuid: "u-1" });
  });

  it("setCardComplete toggles a card's checked state", () => {
    const next = KanbanCore.setCardComplete(SAMPLE, {
      columnTitle: "To Do",
      cardText: "Write a brief",
      complete: true,
    });
    const board = KanbanCore.parseBoard(next);
    const card = board.columns[0].tasks.find((t) => t.text === "Write a brief");
    expect(card!.checked).toBe(true);
  });

  it("deleteCard removes a card", () => {
    const next = KanbanCore.deleteCard(SAMPLE, {
      columnTitle: "To Do",
      cardText: "Write a brief",
    });
    const board = KanbanCore.parseBoard(next);
    expect(board.columns[0].tasks.find((t) => t.text === "Write a brief")).toBeUndefined();
  });

  it("addColumn appends a new heading at the bottom of the note", () => {
    const next = KanbanCore.addColumn(SAMPLE, { title: "Backlog" });
    expect(next.trim().endsWith("## Backlog")).toBe(true);
  });

  it("renameColumn changes the heading text and keeps the level", () => {
    const next = KanbanCore.renameColumn(SAMPLE, {
      oldTitle: "To Do",
      newTitle: "Backlog",
    });
    expect(next).toContain("# Backlog");
    expect(next).not.toContain("# To Do");
  });

  it("deleteColumn prepends orphaned tasks to the implicit (No heading) backlog", () => {
    const next = KanbanCore.deleteColumn(SAMPLE, { title: "In Progress" });
    const board = KanbanCore.parseBoard(next);
    expect(board.columns.find((c) => c.title === "In Progress")).toBeUndefined();
    expect(board.columns[0].title).toBe(KanbanCore.NO_HEADING_TITLE);
    const orphan = board.columns[0].tasks.find((t) => t.text === "Build the prototype");
    expect(orphan).toBeDefined();
  });

  it("reorderColumns reshuffles headings and preserves unknown headings", () => {
    const next = KanbanCore.reorderColumns(SAMPLE, { order: ["Done", "To Do", "In Progress"] });
    const board = KanbanCore.parseBoard(next);
    expect(board.columns.map((c) => c.title)).toEqual(["Done", "To Do", "In Progress"]);
  });

  it("setCardStartDate adds and overwrites the {start:…} token", () => {
    const a = KanbanCore.setCardStartDate(SAMPLE, {
      columnTitle: "To Do",
      cardText: "Write a brief",
      date: "2027-01-15",
    });
    expect(a).toContain("{start:2027-01-15}");
    const b = KanbanCore.setCardStartDate(a, {
      columnTitle: "To Do",
      cardText: "Write a brief",
      date: "2027-02-20",
    });
    expect(b).toContain("{start:2027-02-20}");
    expect(b).not.toContain("2027-01-15");
  });

  it("setCardStartDate with null clears the date", () => {
    const a = KanbanCore.setCardStartDate(SAMPLE, {
      columnTitle: "To Do",
      cardText: "Schedule meeting",
      date: null,
    });
    const board = KanbanCore.parseBoard(a);
    const card = board.columns[0].tasks.find((t) => t.text === "Schedule meeting");
    expect(card!.startDate).toBe(null);
  });

  it("tagCardWithNote appends an Amplenote link", () => {
    const next = KanbanCore.tagCardWithNote(SAMPLE, {
      columnTitle: "To Do",
      cardText: "Write a brief",
      noteName: "Brief",
      noteUUID: "uuid-1",
    });
    expect(next).toContain("[Brief](https://www.amplenote.com/notes/uuid-1)");
  });
});

describe("KanbanCore.footnotes", () => {
  it("parses inline footnote references inside a card's text", () => {
    const md = "# Col\n- [ ] See [^1]\n\n[^1]: [Home](https://home.test)\n\nAfter the blank line.\n";
    const fns = KanbanCore.parseFootnotes(md);
    expect(fns["1"].target).toBe("https://home.test");
    const board = KanbanCore.parseBoard(md);
    const ids = KanbanCore.cardFootnoteIds(board.columns[0].tasks[0]);
    expect(ids).toEqual(["1"]);
  });

  it("parses footnote definition lines as link targets without including the body in the card", () => {
    const md = "# Col\n- [ ] See [^1]\n\n[^1]: [Home](https://home.test)\n\nAfter the blank line.\n";
    const board = KanbanCore.parseBoard(md);
    expect(board.columns[0].tasks[0].body).not.toContain("[^1]");
  });

  it("classifies rich footnotes (image or >1 URL) as embed", () => {
    const fn = { id: "1", label: "x", target: null, body: "![a](https://i.test) text" };
    expect(KanbanCore.classifyFootnote(fn)).toBe("embed");
    const link = { id: "2", label: "y", target: "https://x.test", body: "" };
    expect(KanbanCore.classifyFootnote(link)).toBe("link");
  });
});

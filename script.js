// FocusFlow — Umar's vanilla JS Productivity App
// Data model: { id, title, due (ISO | ""), category, priority (1..3), done (bool), createdAt (ISO), order }
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  // ---- State & Storage ----
  const STORAGE_KEY = "focusflow.tasks.v1";
  const THEME_KEY = "focusflow.theme";
  let tasks = loadTasks();
  let dragSrcId = null;

  function loadTasks(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  }
  function saveTasks(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

  // ---- Theme ----
  const savedTheme = localStorage.getItem(THEME_KEY);
  if(savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
  $("#themeBtn")?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme")==="light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", cur);
    localStorage.setItem(THEME_KEY, cur);
  });

  // ---- Elements ----
  const form = $("#newTaskForm");
  const title = $("#title");
  const due = $("#due");
  const category = $("#category");
  const priority = $("#priority");
  const list = $("#taskList");
  const empty = $("#empty");

  const sortBy = $("#sortBy");
  const search = $("#search");
  const categoryFilter = $("#categoryFilter");
  const chipRow = $("#chipRow");

  const countTotal = $("#countTotal");
  const countPending = $("#countPending");
  const countCompleted = $("#countCompleted");
  const countToday = $("#countToday");

  const exportBtn = $("#exportBtn");
  const importBtn = $("#importBtn");
  const importFile = $("#importFile");

  // ---- Keyboard shortcuts ----
  document.addEventListener("keydown", (e) => {
    if (e.key === "/") { e.preventDefault(); search.focus(); search.select(); }
    if (e.key.toLowerCase() === "n") { e.preventDefault(); title.focus(); }
    if (e.key === "?") { e.preventDefault(); $("#helpDialog").showModal(); }
    if (e.key === "Escape") { if($("#helpDialog").open) $("#helpDialog").close(); }
  });

  // ---- Create Task ----
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if(!title.value.trim()) return;
    const now = new Date();
    const t = {
      id: crypto.randomUUID(),
      title: title.value.trim(),
      due: due.value ? new Date(due.value).toISOString() : "",
      category: category.value,
      priority: Number(priority.value),
      done: false,
      createdAt: now.toISOString(),
      order: tasks.length ? Math.max(...tasks.map(x => x.order || 0)) + 1 : 1
    };
    tasks.unshift(t);
    saveTasks();
    form.reset();
    title.focus();
    render();
  });

  // ---- Render ----
  function render(){
    const q = search.value.trim().toLowerCase();
    const cat = categoryFilter.value;
    const activeChip = $(".chip.is-active")?.dataset.filter || "all";

    let view = tasks.slice();

    // filter by chip
    const todayStr = new Date().toDateString();
    view = view.filter(t => {
      if(activeChip === "completed") return t.done;
      if(activeChip === "pending") return !t.done;
      if(activeChip === "today"){
        if(!t.due) return false;
        return new Date(t.due).toDateString() === todayStr;
      }
      if(activeChip === "overdue"){
        if(!t.due) return false;
        const d = new Date(t.due);
        const today = new Date(); today.setHours(0,0,0,0);
        return !t.done && d < today;
      }
      return true;
    });

    // filter by category
    if(cat !== "all") view = view.filter(t => (t.category||"") === cat);

    // text search
    if(q) view = view.filter(t => t.title.toLowerCase().includes(q));

    // sort
    const sort = sortBy.value;
    view.sort((a,b) => {
      if(sort === "createdDesc") return new Date(b.createdAt) - new Date(a.createdAt);
      if(sort === "createdAsc") return new Date(a.createdAt) - new Date(b.createdAt);
      if(sort === "dueAsc") return (a.due||"") > (b.due||"") ? 1 : -1;
      if(sort === "dueDesc") return (a.due||"") < (b.due||"") ? 1 : -1;
      if(sort === "priorityDesc") return (b.priority||0) - (a.priority||0);
      if(sort === "priorityAsc") return (a.priority||0) - (b.priority||0);
      return (a.order||0) - (b.order||0);
    });

    // stats
    const total = tasks.length;
    const completed = tasks.filter(t=>t.done).length;
    const pending = total - completed;
    const today = tasks.filter(t => t.due && new Date(t.due).toDateString() === new Date().toDateString() && !t.done).length;
    countTotal.textContent = total;
    countPending.textContent = pending;
    countCompleted.textContent = completed;
    countToday.textContent = today;

    // list
    list.innerHTML = "";
    if(!view.length){
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    const tpl = $("#taskTemplate");
    view.forEach(t => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const toggle = $(".toggle", node);
      const input = $(".task-title", node);
      const dueBadge = $(".badge.due", node);
      const catBadge = $(".badge.category", node);
      const priBadge = $(".badge.priority", node);
      const editBtn = $(".edit", node);
      const delBtn = $(".delete", node);

      node.dataset.id = t.id;

      // checkbox
      toggle.checked = !!t.done;
      toggle.addEventListener("change", () => {
        t.done = toggle.checked;
        saveTasks(); render();
      });

      // title
      input.value = t.title;
      input.classList.toggle("completed", !!t.done);
      input.addEventListener("change", () => {
        t.title = input.value.trim();
        saveTasks(); render();
      });

      // meta
      if(t.due){
        const d = new Date(t.due);
        const label = d.toLocaleDateString();
        dueBadge.textContent = `Due ${label}`;
        // overdue/today styling
        const today = new Date(); today.setHours(0,0,0,0);
        const dd = new Date(d); dd.setHours(0,0,0,0);
        if(dd < today && !t.done) dueBadge.classList.add("overdue");
        else if(dd.getTime() === today.getTime()) dueBadge.classList.add("today");
      } else {
        dueBadge.textContent = "No due";
      }
      catBadge.textContent = t.category || "—";

      const priMap = {1:"Low",2:"Medium",3:"High"};
      priBadge.textContent = `Priority ${priMap[t.priority]||"—"}`;
      priBadge.classList.add(`p${t.priority}`);

      // edit
      editBtn.addEventListener("click", () => {
        const newTitle = prompt("Edit title", t.title);
        if(newTitle !== null){
          t.title = newTitle.trim();
          saveTasks(); render();
        }
      });

      // delete
      delBtn.addEventListener("click", () => {
        if(confirm("Delete this task?")){
          tasks = tasks.filter(x => x.id !== t.id);
          saveTasks(); render();
        }
      });

      // drag & drop
      node.addEventListener("dragstart", () => { dragSrcId = t.id; node.classList.add("dragging"); });
      node.addEventListener("dragend", () => { node.classList.remove("dragging"); });
      node.addEventListener("dragover", (e) => {
        e.preventDefault();
        const overId = node.dataset.id;
        if(!dragSrcId || overId === dragSrcId) return;
        const a = tasks.find(x=>x.id===dragSrcId);
        const b = tasks.find(x=>x.id===overId);
        if(!a || !b) return;
        // swap order
        const ao = a.order || 0, bo = b.order || 0;
        a.order = bo; b.order = ao;
        saveTasks(); render();
      });

      list.appendChild(node);
    });
  }

  // ---- Filter chip selection ----
  $$(".chip").forEach(chip => chip.addEventListener("click", () => {
    $$(".chip").forEach(c => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    render();
  }));

  // ---- Controls ----
  search.addEventListener("input", render);
  sortBy.addEventListener("change", render);
  categoryFilter.addEventListener("change", render);

  // ---- Export / Import ----
  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {href:url, download:"focusflow-tasks.json"});
    a.click(); URL.revokeObjectURL(url);
  });

  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(reader.result);
        if(Array.isArray(arr)){
          tasks = arr; saveTasks(); render();
        } else alert("Invalid JSON");
      } catch {
        alert("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
  });

  // ---- Seed (optional for first run) ----
  if(tasks.length === 0){
    const today = new Date();
    const toISO = (d) => new Date(today.getFullYear(), today.getMonth(), today.getDate()+d).toISOString();
    tasks = [
      {id: crypto.randomUUID(), title:"Finish DSA assignment", due: toISO(0), category:"Study", priority:3, done:false, createdAt:new Date().toISOString(), order:1},
      {id: crypto.randomUUID(), title:"Push portfolio update to GitHub", due: toISO(1), category:"Work", priority:2, done:false, createdAt:new Date().toISOString(), order:2},
      {id: crypto.randomUUID(), title:"Gym session", due:"", category:"Personal", priority:1, done:false, createdAt:new Date().toISOString(), order:3},
    ];
    saveTasks();
  }

  // ---- Initial render ----
  render();
})();
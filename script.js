import Alpine from "alpinejs";

// Expose Alpine globally so it can be driven from the console if needed.
window.Alpine = Alpine;

Alpine.data("projects", () => ({
  loading: true,
  projects: [],
  activeTag: null,

  get filteredProjects() {
    return this.activeTag
      ? this.projects.filter((p) => p.tags.includes(this.activeTag))
      : this.projects;
  },

  /** Tags that have at least 2 projects — only these are shown in the filter bar. */
  get filterableTags() {
    const counts = {};
    for (const p of this.projects) {
      for (const t of p.tags) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    return Object.keys(counts)
      .filter((t) => counts[t] >= 2)
      .sort();
  },

  setActiveTag(tag) {
    this.activeTag = tag;
  },

  async init() {
    try {
      const res = await fetch("projects.json");
      if (res.ok) {
        this.projects = await res.json();
      }
    } finally {
      this.loading = false;
    }
  },
}));

Alpine.start();

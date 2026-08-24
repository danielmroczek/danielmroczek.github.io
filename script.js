import Alpine from "alpinejs";

// Expose Alpine globally so it can be driven from the console if needed.
window.Alpine = Alpine;

Alpine.data("projects", () => ({
  loading: true,
  projects: [],
  // No filter UI yet — set this later (e.g. via tag buttons) to enable filtering.
  activeTag: null,

  get filteredProjects() {
    return this.activeTag
      ? this.projects.filter((p) => p.tags.includes(this.activeTag))
      : this.projects;
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

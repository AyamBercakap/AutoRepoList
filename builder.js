
export class RepoBuilder {
  constructor(jsonUrl = 'https://raw.githubusercontent.com/AyamBercakap/AutoRepoList/main/repoList.json') {
    this.jsonUrl = jsonUrl;
    this.config = {
      includePrivate: true,
      includeForks: false,
      excludeNames: [],
      requiredTopic: null,
      sortBy: 'updated-desc',
      schema: (repo) => repo
    };
  }

  filter({ includePrivate = true, includeForks = false, excludeNames = [], requiredTopic = null } = {}) {
    Object.assign(this.config, { includePrivate, includeForks, excludeNames, requiredTopic });
    return this;
  }

  sort(sortBy) {
    this.config.sortBy = sortBy;
    return this;
  }

  mapSchema(schemaFn) {
    this.config.schema = schemaFn;
    return this;
  }

  async build() {
    const res = await fetch(this.jsonUrl);
    let repos = await res.json();

    // Filters
    repos = repos.filter(repo => {
      if (!this.config.includePrivate && repo.visibility === 'private') return false;
      if (!this.config.includeForks && repo.isFork) return false;
      if (this.config.excludeNames.includes(repo.title)) return false;
      if (this.config.requiredTopic && !(repo.topics || []).includes(this.config.requiredTopic)) return false;
      return true;
    });

    // Sorting
    repos.sort((a, b) => {
      if (this.config.sortBy === 'name-asc') return a.title.localeCompare(b.title);
      if (this.config.sortBy === 'stars-desc') return (b.stars || 0) - (a.stars || 0);
      if (this.config.sortBy === 'updated-desc') return new Date(b.rawDate) - new Date(a.rawDate);
      return 0;
    });

    // Transform to Custom Schema
    return repos.map(this.config.schema);
  }
}

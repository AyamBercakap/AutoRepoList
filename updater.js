const fs = require('fs');

const CONFIG = {
  outputFile: './repoList.json',
  verifyImageExists: true,
  fallbackImageUrl: 'https://placehold.co/600x400?text=?',
  buildImageUrl: (repo) =>
    `https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/${repo.default_branch}/src/portfolio.jpg`
};

// Format date to dd-mm-yyyy
function formatDate(isoString) {
  const date = new Date(isoString);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Verify if /src/portfolio.jpg exists in the repo
async function resolveImageUrl(repo, token) {
  const rawUrl = CONFIG.buildImageUrl(repo);
  if (!CONFIG.verifyImageExists) return rawUrl;

  const apiCheckUrl = `https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents/src/portfolio.jpg?ref=${repo.default_branch}`;
  const res = await fetch(apiCheckUrl, {
    method: 'HEAD',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  return res.ok ? rawUrl : CONFIG.fallbackImageUrl;
}

async function run() {
  const token = process.env.GH_PAT;

  const response = await fetch('https://github.com', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API Error: ${response.statusText}`);
  }

  const rawRepos = await response.json();

  // Build master JSON that has all fields
  const masterJson = await Promise.all(
    rawRepos.map(async (repo) => {
      const portfolioImg = await resolveImageUrl(repo, token);

      return {
        title: repo.name,
        visibility: repo.private ? 'private' : 'public',
        isFork: repo.fork,
        portfolioImg,
        updated: formatDate(repo.updated_at),
        rawDate: repo.updated_at, // Kept in ISO format so RepoBuilder can sort accurately
        topics: repo.topics || [],
        description: repo.description || '',
        repoUrl: repo.html_url,
        homepage: repo.homepage || '',
        language: repo.language || 'Plain Text',
        stars: repo.stargazers_count
      };
    })
  );

  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(masterJson, null, 2));
  console.log(`Successfully updated master repos.json with ${masterJson.length} repositories.`);
}

run();

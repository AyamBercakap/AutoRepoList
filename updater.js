const fs = require('fs');

const CONFIG = {
    outputFile: './repoList.json',
    verifyImageExists: true,
    fallbackImageUrl: 'https://placehold.co/600x400?text=?',
    buildImageUrl: (repo) =>
        `https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/${repo.default_branch}/src/portfolio.jpg`
};

const API_HEADERS = (token) => ({
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'AutoRepoList-updater'
});

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
    // Private repo raw URLs won't load in a browser without auth
    if (repo.private) return CONFIG.fallbackImageUrl;

    const rawUrl = CONFIG.buildImageUrl(repo);
    if (!CONFIG.verifyImageExists) return rawUrl;

    const apiCheckUrl = `https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents/src/portfolio.jpg?ref=${repo.default_branch}`;
    const res = await fetch(apiCheckUrl, { headers: API_HEADERS(token) });

    return res.ok ? rawUrl : CONFIG.fallbackImageUrl;
}

async function fetchAllRepos(token) {
    const repos = [];
    for (let page = 1; ; page++) {
        const res = await fetch(
            `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner&sort=updated`,
            { headers: API_HEADERS(token) }
        );
        if (!res.ok) {
            throw new Error(`GitHub API Error ${res.status} ${res.statusText}: ${await res.text()}`);
        }
        const batch = await res.json();
        repos.push(...batch);
        if (batch.length < 100) break;
    }
    return repos;
}

async function run() {
    const token = process.env.GH_PAT;
    if (!token) throw new Error('GH_PAT is not set');

    const rawRepos = await fetchAllRepos(token);

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
                rawDate: repo.updated_at, // ISO format so RepoBuilder can sort accurately
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
    console.log(`Successfully updated repoList.json with ${masterJson.length} repositories.`);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
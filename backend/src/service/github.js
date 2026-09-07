import { Octokit } from "@octokit/rest";

const SKIP_DIRS = [
  "node_modules",
  ".git",
  ".github",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".venv",
  "venv",
  "env",
  "__pycache__",
  ".idea",
  ".vscode",
  "vendor",
  "target",
  "bin",
  "obj",
  "tmp",
  "temp",
  "logs",
];

const SKIP_EXTENSIONS = new Set([
  // Images
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".webp",
  ".avif",
  ".bmp",
  ".tiff",
  // Audio & Video
  ".mp4",
  ".mp3",
  ".wav",
  ".mov",
  ".avi",
  ".flv",
  ".webm",
  ".m4a",
  // Archives & Binaries
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".bz2",
  ".xz",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".wasm",
  ".iso",
  ".dmg",
  // Compiled code
  ".pyc",
  ".pyo",
  ".pyd",
  ".class",
  ".jar",
  ".war",
  ".ear",
  // Database & Fonts
  ".db",
  ".sqlite",
  ".sqlite3",
  ".ttf",
  ".woff",
  ".woff2",
  ".eot",
  ".otf",
  // Lock files & Maps
  ".lock",
  ".map",
]);

const SKIP_FILES = [
  "package-lock.json",
  "bun.lock",
  "bun.lockb",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  ".DS_Store",
  "Thumbs.db",
  ".gitignore",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.test",
];

function shouldSkipFile(path, size = 0) {
  if (!path) return true;

  // Skip files larger than 50KB
  if (size && size > 50 * 1024) {
    return true;
  }

  const normalizedPath = path.replace(/\\/g, "/");
  const parts = normalizedPath.split("/").filter(Boolean);

  if (parts.length === 0) return true;

  // Check if any parent directory is in SKIP_DIRS
  for (let i = 0; i < parts.length - 1; i++) {
    const dir = parts[i].toLowerCase();
    if (SKIP_DIRS.includes(dir)) {
      return true;
    }
  }

  // Check exact filename
  const fileName = parts[parts.length - 1];
  const lowerFileName = fileName.toLowerCase();

  if (SKIP_FILES.some((file) => file.toLowerCase() === lowerFileName)) {
    return true;
  }

  // Check extension
  const extIndex = fileName.lastIndexOf(".");
  if (extIndex !== -1) {
    const ext = fileName.slice(extIndex).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) {
      return true;
    }
  }

  return false;
}

function parseRepoUrl(urlOrRepo) {
  if (typeof urlOrRepo !== "string") {
    throw new Error("Invalid repository URL or name");
  }

  const clean = urlOrRepo.replace(/\.git$/, "").trim();
  let owner = "";
  let repo = "";

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    const urlObj = new URL(clean);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      owner = parts[0];
      repo = parts[1];
    }
  } else {
    const parts = clean.split("/").filter(Boolean);
    if (parts.length === 2) {
      owner = parts[0];
      repo = parts[1];
    }
  }

  if (!owner || !repo) {
    throw new Error(`Could not parse owner and repository from "${urlOrRepo}"`);
  }

  return { owner, repo };
}

async function parseRepo(arg1, arg2, arg3) {
  let owner = "";
  let repo = "";
  let branch = "";
  let token = "";

  if (typeof arg1 === "object" && arg1 !== null) {
    if (arg1.url) {
      const parsed = parseRepoUrl(arg1.url);
      owner = parsed.owner;
      repo = parsed.repo;
    } else {
      owner = arg1.owner || "";
      repo = arg1.repo || "";
    }
    branch = arg1.branch || "";
    token = arg1.githubToken || arg1.token || process.env.GITHUB_TOKEN;
  } else if (typeof arg1 === "string") {
    if (arg1.startsWith("http://") || arg1.startsWith("https://")) {
      const parsed = parseRepoUrl(arg1);
      owner = parsed.owner;
      repo = parsed.repo;
      token = arg2 || process.env.GITHUB_TOKEN;
    } else if (arg1.includes("/")) {
      const parsed = parseRepoUrl(arg1);
      owner = parsed.owner;
      repo = parsed.repo;
      token = arg2 || process.env.GITHUB_TOKEN;
    } else if (arg3) {
      // Signature: (githubToken, owner, repo)
      token = arg1;
      owner = arg2;
      repo = arg3;
    } else {
      // Signature: (owner, repo, token)
      owner = arg1;
      repo = arg2;
      token = process.env.GITHUB_TOKEN;
    }
  }

  token = token || process.env.GITHUB_TOKEN;

  if (!owner || !repo) {
    throw new Error("Repository owner and repo name are required.");
  }

  const octokit = new Octokit({
    auth: token ? token.trim() : undefined,
  });

  if (!branch) {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    branch = repoData.default_branch || "main";
  }

  const { data: treeData } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: "1",
  });

  if (!treeData.tree || !Array.isArray(treeData.tree)) {
    return [];
  }

  const validFiles = treeData.tree.filter(
    (item) =>
      item.type === "blob" &&
      item.path &&
      !shouldSkipFile(item.path, item.size),
  );

  const results = await Promise.all(
    validFiles.map(async (file) => {
      try {
        const { data: blobData } = await octokit.rest.git.getBlob({
          owner,
          repo,
          file_sha: file.sha,
        });

        const content = Buffer.from(blobData.content, "base64").toString(
          "utf-8",
        );
        return {
          path: file.path,
          content,
          size: file.size || 0,
          sha: file.sha,
        };
      } catch (error) {
        console.error(
          `Error fetching content for ${file.path}:`,
          error.message,
        );
        return null;
      }
    }),
  );

  return results.filter(Boolean);
}

export const fetchRepoFiles = parseRepo;

/**
 * Fetches a single file's raw content by blob sha (cheap, single-blob fetch —
 * used to re-materialize a cited file for the source preview without re-walking the tree).
 */
export async function fetchFileBlob(owner, repo, sha, token) {
  const octokit = new Octokit({ auth: token ? token.trim() : undefined });
  const { data } = await octokit.rest.git.getBlob({ owner, repo, file_sha: sha });
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export {
  SKIP_DIRS,
  SKIP_EXTENSIONS,
  SKIP_FILES,
  shouldSkipFile,
  parseRepoUrl,
  parseRepo,
};

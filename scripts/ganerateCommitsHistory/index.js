const bots = [
    "GH:github-actions",
    "GH:GitHub",
    "GH:GitHub Actions",
];
const githubWebInterfaceFlowSignature = {
    committerName: "GitHub",
    committerEmail: "noreply@github.com",
    signatureKey: "4AEE18F83AFDEB23",
};

import console from "../modules/console.js";
import mailmapSet from "../modules/mailmapSet.js";
import { startGroup, endGroup, exportVariable } from "@actions/core";
import { isInMasterBranch } from "../modules/octokit.js";
import { git } from "../modules/git.js";
import { writeFile } from "../modules/jsonModule.js";
import createCommit from "../modules/createCommit.js";
if (!isInMasterBranch) {
    console.info("Not running in non-master branch, exit.");
    process.exit(0);
}
console.info("Initialization done.");
console.info("Start to fetch raw history");
const { all: rawHistory } = await git.log({
    format: {
        hash: "%H",
        date: "%aI",
        authorName: "%aN",
        _authorEmail: "%aE",
        committerName: "%cN",
        _committerEmail: "%cE",
        signatureKey: "%GK",
    },
    "--stat": "10000",
});
startGroup("Raw history:");
console.info(rawHistory);
endGroup();
const history = {};
startGroup("Raw history parsing:");
for (const { hash, date, authorName, _authorEmail, signatureKey, committerName, _committerEmail, diff } of rawHistory) {
    const authorEmail = _authorEmail.toLowerCase();
    const committerEmail = _committerEmail.replace(/ò$/, "").trim().toLowerCase();
    console.info("Parsing:", { date, hash, authorName, authorEmail, committerName, committerEmail, signatureKey, diff });
    const isFromGithubWebInterface = signatureKey === githubWebInterfaceFlowSignature.signatureKey && committerName === githubWebInterfaceFlowSignature.committerName && committerEmail === githubWebInterfaceFlowSignature.committerEmail;
    console.info("\tisFromGithubWebInterface:", isFromGithubWebInterface);
    const name = isFromGithubWebInterface ? authorName : committerName;
    const email = isFromGithubWebInterface ? authorEmail : committerEmail;
    console.info("\tname:", name);
    console.info("\temail:", email);
    const username = `${mailmapSet.includes(email) ? "U:" : "GH:"}${name}`;
    console.info("\tusername:", username);
    if (username.endsWith("[bot]") || bots.includes(username)) {
        console.info("\tThis commit came from a bot, skip.");
        continue;
    }
    if (!Array.isArray(history[username])) {
        history[username] = [];
    }
    let changedFiles = 0;
    if (Array.isArray(diff?.files)) {
        console.info("\tdiff.files:", diff.files);
        for (const { file, changes, before, after, binary } of diff.files) {
            if ((binary ? before !== after : changes > 0) && file.startsWith("src/")) {
                changedFiles++;
            }
        }
        console.info("\tchangedFiles:", changedFiles);
    } else {
        console.info("\tNothing changed by this commit.");
    }
    if (changedFiles === 0) {
        console.info("\tNothing in src/ has been changed, skip.");
        continue;
    }
    history[username].push({
        commit: hash,
        datetime: date,
        changedFiles,
    });
}
endGroup();
const usernames = Object.keys(history).sort();
const sortedHistory = Object.fromEntries(Object.entries(history).sort(([a], [b]) => usernames.indexOf(a) - usernames.indexOf(b)));
startGroup("Parsed history:");
console.info(sortedHistory);
endGroup();
await writeFile("src/global/zh/MediaWiki:GHIAHistory.json", sortedHistory);
await createCommit("auto: commit history generated by ganerateCommitsHistory");
exportVariable("linguist-generated-generatePolyfill", JSON.stringify(["src/global/zh/MediaWiki:GHIAHistory.json"]));
console.info("Done.");
const cp = require('child_process');
const del = require("del");

/**
 * Summary:
 * Fetch a git repository and dump the contents in a given directory.
 * 
 * The original use-case was fetching some content for a static site. This script
 * allowed me to store the content separately from the website.
 */

const runIf = (process.env.CI || process.env.DEBUG === "notes");

// Run a shell command
function result(command) {
    return new Promise((resolve, reject) => {
        cp.exec(command, function(err, stdout, stderr){
            if(err != null){
                reject(err);
            }else if(typeof(stderr) != "string"){
                reject(stderr);
            }else{
                resolve(stdout);
            }
        })
    })
}

async function configureGit() {
    // Git must be installed
    try {
        await result("git --version");
    } catch(error) {
        throw error;
    }

    // To attempt the merge, we need a git user
    try {
        await result("git config user.name && git config user.email")
    } catch (error) {
        await result("git config user.name \"Buildbot\" && git config user.email \"foo@example.com\"");
    }

    // Add remote `notes`, if not existing.
    try {
        await result("git remote get-url notes");
        console.log("[scripts] Remote `notes` found");
    } catch (error) {
        await result("git remote add notes https://github.com/binyamin/notes");
    }

    // Finally, we setup git refs for remote `notes`
    try {
        await result("git fetch notes")
    } catch(error) {
        throw new Error(error);
    }
}

function copyNotes() {
    /*
        This function copies the contents of `notes/master` into a subdirectory
        without committing them, yet leaving the working tree clean. It's based on
        https://bneijt.nl/blog/post/merge-a-subdirectory-of-another-repository-with-git/
    */

    // Merge will fail, but git remembers the `notes/master` file tree
    result("git merge -s ours --no-commit notes/master")
    .catch(__ => {})
    .finally(async () => {
        // Note: Merge command failed, so we use .finally() instead of .then()
        try {
            // Prepare directory
            await del(["html/wiki/**/*.md", "html/wiki/.git*"]);

            // Read & save the notes files which we tried to merge above
            await result("git read-tree --prefix=html/wiki/ -u notes/master");

            // Reset the working tree, so notes are ignored
            await result("git reset");

            // Clean directory
            del(["html/wiki/.git*"]);
        } catch (err) {
            throw err;
        }
    })
}

if(runIf) {
    configureGit()
        .then(() => {
            copyNotes();
            console.log("[scripts] Notes written to `html/wiki`")
        })
        .catch(e => {
            console.error(e);
            process.exit(1);
        })
}
else {
    console.log("[scripts] Not CI, skipping fetchNotes");
}

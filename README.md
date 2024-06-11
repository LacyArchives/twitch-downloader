# Getting Started

## Using GitHub Templates (recommended)
- Hit "Use this template" in the top right corner of the repository
![Use this Template button on GitHub, located in the top right](https://i.imgur.com/B6uise7.png)
- Hit "Create a new repository"
- Enter the designated name and then clone that repository as you would

## Cloning
If you choose to clone this template repository instead, and you're not making changes to the template itself, you might want to reset the git repository so that commits from this template do not show up on your new repository. To reset history, remove the `.git` folder and then re-create it using the new repository setup instructions 
from your git provider.

If you'd like to leave the history, you may just need to switch the remote to your new repository using `git remote set-url origin new-origin`.

## Setup
- Ensure that you have [Node.js](https://nodejs.org/en/download/package-manager) v21.x or later installed along with [Yarn](https://yarnpkg.com/).
- Change the name in the [package.json](https://github.com/LacyArchives/ts-template/blob/main/package.json) to your project name 
- Install dependencies by typing `yarn` 
- Run using one of the build scripts in the [package.json](https://github.com/LacyArchives/ts-template/blob/main/package.json) to ensure everything is working. For rapid development, I recommend opening a terminal and running `yarn watch` so it rebuilds on each save, and then running it when ready using `yarn start`. 
- Additionally, this comes packaged with a linter, [ESLint](https://eslint.org/), you may want to set that up in VSCode as a formatter in settings and then set it up to format on save. You can also run `yarn lint` to have it lint on command, this is run each time on `yarn dev`, but not in `yarn watch` or `yarn start` for performance.

Finally, you might want to edit this file to fit your project.
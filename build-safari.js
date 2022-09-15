import boxen              from "boxen";
import chalk              from "chalk";
import * as child_process from "child_process";
import dotenv             from "dotenv";
import fs                 from "fs";
import ora                from "ora";
import path               from "path";

const configFile = path.join(".", "build-safari.json");
const teamKey = "DEVELOPMENT_TEAM";

const defaultConfig = {
	"srcDir"      : "./src",
	"buildDir"    : "build",
	"appName"     : "My App",
	"buildCommand": null,
	"__NOTE__": "Don't forget to set the environment variable " + teamKey
};

dotenv.config();
const boxConfig = {
	padding    : 1,
	margin     : 1,
	borderStyle: "double"
};

let config;

if(!fs.existsSync(configFile))
{
	fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, "\t"));
	console.log(
		boxen("No config detected\nGenerating default config\nPlease see " + chalk.blue(configFile), boxConfig));
	process.exit(1);
}
else
{
	config = JSON.parse(fs.readFileSync(configFile).toString());

	if(process.env[teamKey])
	{
		config.team = process.env[teamKey];
	}
	else
	{
		console.log(chalk.red(
			`No ${teamKey} environment variable found; please set this variable or use .env to do so and try again`));
		process.exit(1);
	}

	console.log(boxen("Configuration found!\n" + JSON.stringify(config, null, "    ")));
}

let spinner = ora("Doing sanity checks").start();
const srcDir = path.join(".", config.srcDir);

if( !fs.existsSync(srcDir))
{
	spinner.fail("Could not find srcDir");
	process.exit(1);
}

if( !fs.existsSync(path.join(srcDir,"manifest.json")))
{
	spinner.fail("Could not find " + path.join(srcDir,"manifest.json") );
	process.exit(1);
}

const buildDir = path.join(".", config.buildDir);
const appName = config.appName;

if( !appName.match(/^[a-zA-z0-9\s]+$/) )
{
	spinner.fail("Invalid app name: " + appName );
	process.exit(1);
}

const buildCommand = config.buildCommand;
const team = config.team;

if( !team || !team.match(/[a-zA-Z0-9]{10}/) )
{
	spinner.fail("Invalid team: " + team );
	process.exit(1);
}

spinner.succeed("Sanity checks passed");

if(fs.existsSync(buildDir))
{
	spinner = ora("Cleaning build dir").start();
	fs.rmSync(buildDir, {recursive: true});
	spinner.succeed("Build dir cleaned");
}

if(buildCommand)
{
	spinner = ora("Building base extension").start();
	child_process.execSync(buildCommand);
	spinner.succeed("Built base extension");
}

spinner = ora("Finding XCRun").start();
const xcrun = child_process.execSync("whereis xcrun").toString().split(" ")[1];
spinner.succeed("XCRun: " + xcrun);

spinner = ora("Finding XCodeBuild").start();
const xcodebuild = child_process.execSync("whereis xcodebuild").toString().split(" ")[1];
spinner.succeed("XCodeBuild: " + xcodebuild);

let command = `"${xcrun}" safari-web-extension-converter --project-location "${buildDir}" --app-name "${appName}" --no-prompt --force --no-open "${srcDir}"`;
spinner = ora("Converting extension").start();
child_process.execSync(command);
spinner.succeed("Extension converted");

command = `cd "${path.join(buildDir, appName)}"; "${xcodebuild}" -target "${appName} (macOS)" DEVELOPMENT_TEAM=${team}`;
spinner = ora("Building extension").start();
child_process.execSync(command);
const destDir = path.join(buildDir, appName, "build", "Release");

if(fs.existsSync(path.join(destDir, appName + ".app")))
{
	spinner.succeed("Extension built");
	spinner = ora("Cleaning up after build").start();
	fs.cpSync(destDir, buildDir, {recursive: true});
	fs.rmSync(path.join(buildDir, appName), {recursive: true});
	spinner.succeed("All done!");
}
else
{
	spinner.fail("Failed to build extension");
}

console.log(boxen(chalk.blue("NOTE")+": The app will still be tied to this directory\nAny changes made to this directory will be reflected in Safari immediately",boxConfig));

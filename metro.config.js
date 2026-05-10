const { getDefaultConfig } = require("@expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const STATE_DIR = path.join(__dirname, ".local", "state");
const SKILLS_DIR = path.join(__dirname, ".local", "skills");
const MCP_DIR = path.join(__dirname, ".local", "mcp_skills");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

config.resolver.blockList = [
  new RegExp(`^${escapeRegex(STATE_DIR)}(/.*)?$`),
  new RegExp(`^${escapeRegex(SKILLS_DIR)}(/.*)?$`),
  new RegExp(`^${escapeRegex(MCP_DIR)}(/.*)?$`),
];

module.exports = config;

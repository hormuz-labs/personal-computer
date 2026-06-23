const [,, profile, action, ...args] = process.argv;

if (!profile || !action) {
  console.error("Usage: node discord.js <profile> <action> [args...]");
  process.exit(1);
}

const API_URL = "http://127.0.0.1:10086/command";
const SESSION = "discord-task-" + Math.floor(Math.random() * 100000);

async function sendCmd(cmdAction, cmdArgs = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: cmdAction,
      args: cmdArgs,
      session: SESSION,
      profile: profile
    })
  });
  return res.json();
}

function findNode(tree, name, role) {
  if (tree.name && tree.name.includes(name) && (!role || tree.role === role)) {
    return tree;
  }
  if (tree.children) {
    for (const child of tree.children) {
      const found = findNode(child, name, role);
      if (found) return found;
    }
  }
  return null;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (action === "switch-server") {
    const [serverName] = args;
    console.log(`Switching to server: ${serverName}...`);
    const snap = await sendCmd("snapshot");
    const node = findNode(snap.data.tree, serverName, "treeitem") || findNode(snap.data.tree, serverName, "link");
    if (!node || !node.ref) {
      console.error(`Could not find server ${serverName} in snapshot.`);
      process.exit(1);
    }
    const clickRes = await sendCmd("click", { selector: node.ref });
    console.log("Clicked server:", clickRes.data);

  } else if (action === "dm") {
    const [username, ...msgParts] = args;
    const message = msgParts.join(" ");
    console.log(`Sending DM to ${username}...`);
    
    // Try to find an existing Discord tab first
    let tabsRes = await sendCmd("list_tabs");
    let discordTab = tabsRes.tabs && tabsRes.tabs.find(t => t.url.includes("discord.com/channels"));
    
    if (discordTab) {
        // Use find_tab with exact url to acquire it into our session
        await sendCmd("find_tab", { url: discordTab.url });
        await sendCmd("navigate", { url: "https://discord.com/channels/@me" });
    } else {
        await sendCmd("navigate", { url: "https://discord.com/channels/@me", newTab: true });
    }
    await sleep(2000);
    
    let snap = await sendCmd("snapshot");
    if (!snap || !snap.data || !snap.data.tree) {
       console.log("Snapshot failed. Retrying...");
       await sleep(2000);
       snap = await sendCmd("snapshot");
    }
    let userNode = findNode(snap.data.tree, username, "link");
    if (!userNode) {
       console.log("Not loaded yet. Retrying snapshot...");
       await sleep(3000);
       snap = await sendCmd("snapshot");
       userNode = findNode(snap.data.tree, username, "link");
    }
    
    if (userNode && userNode.ref) {
      console.log(`Clicking user ${username} from sidebar...`);
      await sendCmd("click", { selector: userNode.ref });
      await sleep(2000);
    } else {
      console.log(`Could not find ${username} in DM list.`);
      process.exit(1);
    }
    
    snap = await sendCmd("snapshot");
    const chatInput = findNode(snap.data.tree, "Message @", "textbox") || findNode(snap.data.tree, "Message ", "textbox");
    
    if (!chatInput || !chatInput.ref) {
       console.log("Pasting text into chat input...");
       await sendCmd("evaluate", { code: `(()=>{
            const el = document.querySelector('[class*="markup_"][role="textbox"]');
            if (!el) return false;
            el.innerHTML = "";
            el.focus();
            const dt = new DataTransfer();
            dt.setData("text/plain", \`${message}\`);
            const pasteEvent = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
            el.dispatchEvent(pasteEvent);
            return true;
       })()`});
    } else {
       console.log("Pasting text into chat input...");
       await sendCmd("evaluate", { code: `(()=>{
            const el = document.querySelector('[class*="markup_"][role="textbox"]');
            if (!el) return false;
            el.innerHTML = "";
            el.focus();
            const dt = new DataTransfer();
            dt.setData("text/plain", \`${message}\`);
            const pasteEvent = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
            el.dispatchEvent(pasteEvent);
            return true;
       })()`});
    }

    await sleep(500);
    const sendRes = await sendCmd("evaluate", { code: `(()=>{
         const el = document.querySelector('[class*="markup_"][role="textbox"]');
         if (!el) return false;
         el.focus();
         const key = Object.keys(el).find(k => k.startsWith('__reactEventHandlers$') || k.startsWith('__reactProps$'));
         if (!key) return false;
         const ev = new KeyboardEvent('keydown', {key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true});
         ev.isDefaultPrevented = () => false;
         ev.isPropagationStopped = () => false;
         Object.defineProperty(ev, 'target', { get: () => el });
         Object.defineProperty(ev, 'currentTarget', { get: () => el });
         el[key].onKeyDown(ev);
         return true;
    })()`});
    console.log("Message sent successfully.");
    
  } else if (action === "screenshot") {
    const [path] = args;
    const outputPath = path || `/tmp/discord_screenshot_${Date.now()}.png`;
    console.log(`Taking screenshot: ${outputPath}...`);
    const res = await sendCmd("screenshot", { path: outputPath });
    console.log("Screenshot saved to:", res.data.path);

  } else if (action === "read-messages") {
    // Reads the last N messages from the current channel
    const limit = args[0] ? parseInt(args[0], 10) : 5;
    console.log(`Reading last ${limit} messages from current channel...`);
    const res = await sendCmd("evaluate", { code: `(()=>{
         const msgs = Array.from(document.querySelectorAll('[class*="messageListItem_"]'));
         return msgs.slice(-${limit}).map(m => m.innerText).join('\\n---\\n');
    })()`});
    console.log("Messages:\\n" + res.data.value);
  } else {
    console.error("Unknown action:", action);
    console.log("Available actions: switch-server, dm, screenshot, read-messages");
  }
}

main().catch(console.error);

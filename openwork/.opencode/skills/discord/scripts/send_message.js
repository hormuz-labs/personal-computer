const [,, profile, channel, ...messageParts] = process.argv;
const message = messageParts.join(" ");

if (!profile || !channel || !message) {
  console.error("Usage: node send_message.js <profile> <channel> <message>");
  process.exit(1);
}

const API_URL = "http://127.0.0.1:10086/command";
const SESSION = "discord-task";

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
  console.log(`Sending message to channel ${channel}...`);
  
  let snap = await sendCmd("snapshot");
  
  // Find the channel and click it
  let channelNode = findNode(snap.data.tree, channel, "link");
  if (!channelNode || !channelNode.ref) {
      console.log(`Could not find channel ${channel} by name. Let's try appending ' (text channel)'.`);
      channelNode = findNode(snap.data.tree, `${channel} (text channel)`, "link");
  }
  
  if (channelNode && channelNode.ref) {
      console.log(`Clicking channel ${channel}...`);
      await sendCmd("click", { selector: channelNode.ref });
      await sleep(2000);
  } else {
      console.log(`Warning: Could not find channel ${channel} in the left sidebar. Ensure you are on the right server. Attempting to send message anyway assuming we are in the right channel.`);
  }

  // Get a fresh snapshot to find the message input
  snap = await sendCmd("snapshot");
  
  // The message input usually has role "textbox" and name "Message #channelname"
  const chatInput = findNode(snap.data.tree, `Message #`, "textbox");
  
  if (!chatInput || !chatInput.ref) {
     console.log("Could not find chat input via snapshot. Trying fill approach with generic selector...");
     const fillRes = await sendCmd("fill", { selector: '[class*="markup_"][role="textbox"]', value: message });
     if (!fillRes.data || !fillRes.data.success) {
         console.error("Failed to fill chat input element:", fillRes);
         process.exit(1);
     }
  } else {
     console.log("Filling chat input...");
     await sendCmd("fill", { selector: chatInput.ref, value: message });
  }

  await sleep(500);
  
  // Press Enter to send
  console.log("Sending message...");
  await sendCmd("evaluate", { code: `
       const editor = document.querySelector('[class*="markup_"][role="textbox"]');
       if (editor) {
           const ev = new KeyboardEvent('keydown', {key:'Enter', code:'Enter', keyCode: 13, which: 13, bubbles: true});
           editor.dispatchEvent(ev);
       }
  `});
  console.log("Message sent successfully.");
}

main().catch(console.error);

import { log } from "./util";

figma.ui.onmessage = async (msg) => {
  if (msg.type === "initial-render") {
    inspectSelection();
  }

  if (msg.type === "expand-ui") {
    figma.ui.resize(540, 100);
  }

  if (msg.type === "collapse-ui") {
    figma.ui.resize(540, 600);
  }

  if (msg.type === "inspect") {
    await figma.clientStorage.setAsync("metadata-inspector", msg.payload);
    inspectSelection();
  }

  if (msg.type === "update-storage") {
    figma.clientStorage.setAsync("metadata-inspector", {...msg.payload});
  }

  if (msg.type === "update-node") {
    const {id, nameSpace, key, value} = msg.payload;
    const node = figma.getNodeById(id);
    node.setSharedPluginData(nameSpace, key, value);
    // User might click outside of the plugin UI, so selection might become invalid
    const selection = validateSelection();
    if (selection) {
      const pluginData = getSharedPluginData(selection, nameSpace, key);
      figma.ui.postMessage({
        type: "data-update",
        payload: pluginData,
      });
    }
  }
};

function validateSelection(): SceneNode {
  const selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) {
    return null;
  }
  return selection[0];
}

// recursive
function getSharedPluginData(
  node: SceneNode,
  nameSpace: string,
  key: string
): any {
  if (nameSpace.length < 4) {
    figma.ui.postMessage({
      type: "error",
      payload: "Invalid namespace",
    })
    return null;
  }
  try {
    const pluginData = node.getSharedPluginData(nameSpace, key);
    let childData;
    if ("children" in node) {
      childData = node.children.map((child) =>
      getSharedPluginData(child, nameSpace, key)
      );
    }
    return {
      name: node.name,
      id: node.id,
      type: node.type,
      pluginData,
      childData,
    };
  } catch (e) {
    debugger;
    console.log(e)
    return;
  }
}

async function inspectSelection() {
  const clientData = await figma.clientStorage.getAsync("metadata-inspector");
  if (!clientData) {
    await figma.clientStorage.setAsync("metadata-inspector", {});
  }

  if (!clientData || !clientData.nameSpace || !clientData.key || clientData.nameSpace.length < 4) {
    figma.ui.postMessage({
      type: "error",
      payload: "Enter a valid namespace and key to inspect the shared plugin data. Namespace must be 4 or more characters."
    });
    return;
  }
  const node = validateSelection();
  if (!node) {
    figma.ui.postMessage({
      type: "error",
      payload: "Select a layer to inspect its shared plugin data."
    });
    return;
  }

  const pluginData = getSharedPluginData(
    node,
    clientData.nameSpace,
    clientData.key
  );
  figma.ui.postMessage({
    type: "selection-update",
    payload: pluginData,
  });

}

async function getClientData() {
  const data = await figma.clientStorage.getAsync("metadata-inspector");
  if (data) {
    return data;
  }
  return {
    namespace: "",
    key: "",
  };
}

figma.on("selectionchange", async () => {
  inspectSelection();
});

async function init() {
  figma.showUI(__html__, {
    title: "Monocle Metadata Inspector",
    width: 500,
    height: 340,
  });

  const clientData = await getClientData();
  if (!clientData) {
    await figma.clientStorage.setAsync("metadata-inspector", {});
  }
  figma.ui.postMessage({
    type: "init",
    payload: clientData
  });
}

init();
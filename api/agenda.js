const { addItems, checkAccess, deleteItem, listItems, sendError, updateItem } = require("../lib/agenda");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const denied = checkAccess(req);
  if (denied) {
    res.status(denied.status).json({ error: denied.error });
    return;
  }

  try {
    switch (req.method) {
      case "GET": {
        const items = await listItems(req.query.from, req.query.to);
        res.status(200).json({ items });
        return;
      }
      case "POST": {
        const body = req.body ?? {};
        const items = await addItems(Array.isArray(body.items) ? body.items : [body]);
        res.status(201).json({ items });
        return;
      }
      case "PATCH": {
        const item = await updateItem(req.query.id, req.body ?? {});
        res.status(200).json({ item });
        return;
      }
      case "DELETE": {
        await deleteItem(req.query.id);
        res.status(200).json({ ok: true });
        return;
      }
      default:
        res.setHeader("Allow", "GET, POST, PATCH, DELETE");
        res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    sendError(res, error);
  }
};

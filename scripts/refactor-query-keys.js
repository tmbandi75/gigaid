module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const replacements = {
    smsConversation: "leads.sms",
    lead: "leads.detail",
    invoice: "invoices.detail",
    smsConversations: "messaging.inbox",
  };

  root
    .find(j.CallExpression, {
      callee: {
        object: { name: "QUERY_KEYS" },
        property: { type: "Identifier" },
      },
    })
    .forEach((path) => {
      const oldName = path.node.callee.property.name;
      if (!replacements[oldName]) return;

      const parts = replacements[oldName].split(".");

      let newCallee = j.memberExpression(
        j.identifier("QUERY_KEYS"),
        j.identifier(parts[0])
      );

      for (let i = 1; i < parts.length; i++) {
        newCallee = j.memberExpression(
          newCallee,
          j.identifier(parts[i])
        );
      }

      path.node.callee = newCallee;
    });

  return root.toSource({ quote: "single" });
};

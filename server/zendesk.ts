/**
 * Zendesk Integration Service
 * Provides authenticated access to Zendesk API for customer support tickets
 * Integration: connection:conn_zendesk_01KEZTDWVQAZYEJ4WT94GRC69V
 */

let connectionSettings: any;

async function getCredentials() {
  if (
    connectionSettings &&
    connectionSettings.settings.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    return {
      token: connectionSettings.settings.access_token,
      subdomain: connectionSettings.settings.subdomain,
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" +
      hostname +
      "/api/v2/connection?include_secrets=true&connector_names=zendesk",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    },
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  const accessToken =
    connectionSettings?.settings?.access_token ||
    connectionSettings.settings?.oauth?.credentials?.access_token;

  if (
    !connectionSettings ||
    !accessToken ||
    !connectionSettings.settings.subdomain
  ) {
    throw new Error("Zendesk not connected");
  }
  return {
    token: accessToken,
    subdomain: connectionSettings.settings.subdomain,
  };
}

export async function zendeskFetch(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: any,
) {
  const { token, subdomain } = await getCredentials();
  const baseUrl = `https://${subdomain}.zendesk.com/api/v2`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(`${baseUrl}/${endpoint}`, {
    headers,
    method,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zendesk API Error (${response.status}): ${error}`);
  }

  return response.json();
}

export interface SupportTicket {
  subject: string;
  description: string;
  priority?: "low" | "normal" | "high" | "urgent";
  type?: "question" | "incident" | "problem" | "task";
  tags?: string[];
  requesterEmail: string;
  requesterName: string;
}

export interface ZendeskTicketResponse {
  ticket: {
    id: number;
    url: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    created_at: string;
    updated_at: string;
  };
}

export async function createSupportTicket(ticket: SupportTicket): Promise<ZendeskTicketResponse> {
  const zendeskTicket = {
    ticket: {
      subject: ticket.subject,
      comment: {
        body: ticket.description,
      },
      priority: ticket.priority || "normal",
      type: ticket.type || "question",
      tags: ticket.tags || ["gigaid", "app-support"],
      requester: {
        email: ticket.requesterEmail,
        name: ticket.requesterName,
      },
    },
  };

  return zendeskFetch("tickets.json", "POST", zendeskTicket);
}

export async function getTicketsByEmail(email: string): Promise<any> {
  const searchQuery = encodeURIComponent(`requester:${email} type:ticket`);
  return zendeskFetch(`search.json?query=${searchQuery}`);
}

export async function getTicketById(ticketId: number): Promise<any> {
  return zendeskFetch(`tickets/${ticketId}.json`);
}

export async function addTicketComment(ticketId: number, comment: string, isPublic: boolean = true): Promise<any> {
  return zendeskFetch(`tickets/${ticketId}.json`, "PUT", {
    ticket: {
      comment: {
        body: comment,
        public: isPublic,
      },
    },
  });
}

export async function getTicketComments(ticketId: number): Promise<any> {
  return zendeskFetch(`tickets/${ticketId}/comments.json`);
}

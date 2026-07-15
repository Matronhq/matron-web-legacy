/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import AttachmentIcon from "@vector-im/compound-design-tokens/assets/web/icons/attachment";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";
import ChevronLeftIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-left";
import ComposeIcon from "@vector-im/compound-design-tokens/assets/web/icons/compose";
import InfoIcon from "@vector-im/compound-design-tokens/assets/web/icons/info-solid";
import SearchIcon from "@vector-im/compound-design-tokens/assets/web/icons/search";
import SendIcon from "@vector-im/compound-design-tokens/assets/web/icons/send-solid";
import SettingsIcon from "@vector-im/compound-design-tokens/assets/web/icons/settings";

import { errorMessage, type MatronJournalClient } from "./client";
import {
    asNumber,
    asString,
    type ClientState,
    conversationTitle,
    displaySender,
    type EventPayload,
    type JournalEvent,
    type SessionStatus,
    type ToolStreamState,
} from "./types";

function formatTime(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function formatBytes(value: unknown): string | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function conversationInitial(title: string): string {
    return Array.from(title.trim())[0]?.toLocaleUpperCase() || "M";
}

function LoginScreen({ client, state }: { client: MatronJournalClient; state: ClientState }): React.ReactElement {
    const [server, setServer] = useState(client.suggestedServer());
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(state.connectionError);

    const submit = async (event: FormEvent): Promise<void> => {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
            await client.login(server, username, password);
        } catch (loginError) {
            setError(errorMessage(loginError));
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="mj_Login">
            <section className="mj_LoginCard">
                <div className="mj_BrandMark" aria-hidden="true">
                    M
                </div>
                <h1>Sign in</h1>
                <p className="mj_LoginIntro">Continue to {state.config.brand || "Matron"}</p>
                <form onSubmit={(event) => void submit(event)}>
                    <label>
                        Journal server
                        <input
                            type="text"
                            inputMode="url"
                            value={server}
                            onChange={(event) => setServer(event.target.value)}
                            placeholder="https://chat.example.com"
                            autoComplete="url"
                            required
                            autoFocus={!server}
                        />
                    </label>
                    <label>
                        Username
                        <input
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            autoComplete="username"
                            required
                            autoFocus={Boolean(server)}
                        />
                    </label>
                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>
                    {error && (
                        <div className="mj_Error" role="alert">
                            {error}
                        </div>
                    )}
                    <button className="mj_PrimaryButton" type="submit" disabled={busy}>
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </form>
                {state.config.privacy_policy_url && (
                    <a
                        className="mj_PrivacyLink"
                        href={state.config.privacy_policy_url}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Privacy policy
                    </a>
                )}
            </section>
        </main>
    );
}

function ConversationList({ client, state }: { client: MatronJournalClient; state: ClientState }): React.ReactElement {
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<"all" | "unread" | "rooms">("all");
    const [accountOpen, setAccountOpen] = useState(false);
    const [composeHint, setComposeHint] = useState(false);
    const conversations = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase();
        return state.conversations.filter((conversation) => {
            if (filter === "unread" && conversation.unread_count === 0) return false;
            if (filter === "rooms") return false;
            return (
                !normalized ||
                `${conversation.title} ${conversation.id} ${conversation.snippet}`
                    .toLocaleLowerCase()
                    .includes(normalized)
            );
        });
    }, [filter, query, state.conversations]);

    return (
        <aside className={`mj_Sidebar ${state.selectedConversationId ? "mj_Sidebar_mobileHidden" : ""}`}>
            <header className="mj_SidebarHeader">
                <strong>Home</strong>
                <div className="mj_SidebarActions">
                    <button
                        className="mj_IconButton"
                        onClick={() => {
                            setComposeHint(false);
                            setAccountOpen((open) => !open);
                        }}
                        title="Settings"
                        aria-label="Settings"
                        aria-expanded={accountOpen}
                    >
                        <SettingsIcon />
                    </button>
                    <button
                        className="mj_IconButton"
                        onClick={() => {
                            setAccountOpen(false);
                            setComposeHint((open) => !open);
                        }}
                        title="New conversation"
                        aria-label="New conversation"
                        aria-expanded={composeHint}
                    >
                        <ComposeIcon />
                    </button>
                </div>
                {accountOpen && (
                    <div className="mj_HeaderMenu mj_AccountMenu">
                        <strong>{state.session?.username}</strong>
                        <span>{state.session?.serverUrl}</span>
                        <button onClick={() => void client.logout()}>Sign out</button>
                    </div>
                )}
                {composeHint && (
                    <div className="mj_HeaderMenu mj_ComposeHint">
                        New conversations appear when an agent starts a session.
                    </div>
                )}
            </header>
            <div className="mj_Search">
                <SearchIcon aria-hidden="true" />
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search conversations"
                    aria-label="Search conversations"
                />
            </div>
            <div className="mj_Filters" aria-label="Conversation filters">
                <button
                    className={filter === "unread" ? "mj_Filter_active" : ""}
                    onClick={() => setFilter((current) => (current === "unread" ? "all" : "unread"))}
                >
                    Unreads
                </button>
                <button onClick={() => setFilter("all")}>People</button>
                <button className={filter === "rooms" ? "mj_Filter_active" : ""} onClick={() => setFilter("rooms")}>
                    Rooms
                </button>
                <button className="mj_FilterMore" onClick={() => setFilter("all")} aria-label="Show all conversations">
                    <ChevronDownIcon />
                </button>
            </div>
            <div className="mj_ConversationList">
                {conversations.map((conversation) => (
                    <button
                        key={conversation.id}
                        className={`mj_Conversation ${conversation.id === state.selectedConversationId ? "mj_Conversation_selected" : ""}`}
                        onClick={() => void client.selectConversation(conversation.id)}
                    >
                        <span className={`mj_Avatar mj_Avatar_${conversation.session_state}`} aria-hidden="true">
                            {conversationInitial(conversationTitle(conversation))}
                        </span>
                        <span className="mj_ConversationBody">
                            <span className="mj_ConversationLine">
                                <strong>{conversationTitle(conversation)}</strong>
                            </span>
                            <span className="mj_ConversationLine mj_ConversationPreview">
                                <span>{conversation.snippet || "No messages yet"}</span>
                                {conversation.unread_count > 0 && (
                                    <span className="mj_Unread" aria-label={`${conversation.unread_count} unread`}>
                                        {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                                    </span>
                                )}
                            </span>
                        </span>
                    </button>
                ))}
                {conversations.length === 0 && (
                    <div className="mj_EmptyList">
                        {query || filter !== "all"
                            ? "No matching conversations"
                            : "Your agent conversations will appear here."}
                    </div>
                )}
            </div>
        </aside>
    );
}

function SessionStatusView({ status }: { status?: SessionStatus }): React.ReactElement | null {
    if (!status) return null;
    return (
        <div className="mj_StatusDetails">
            {status.model && <span>{status.model}</span>}
            {status.context && (
                <span
                    title={`${status.context.tokens.toLocaleString()} / ${status.context.window.toLocaleString()} tokens`}
                >
                    Context {status.context.pct}%
                </span>
            )}
            {status.limits?.map((limit) => (
                <span key={limit.label} title={limit.resets ? `Resets ${limit.resets}` : undefined}>
                    {limit.label} {limit.percent}%
                </span>
            ))}
        </div>
    );
}

function ChatHeader({ client, state }: { client: MatronJournalClient; state: ClientState }): React.ReactElement {
    const conversation = client.selectedConversation();
    const [infoOpen, setInfoOpen] = useState(false);
    const title = conversation ? conversationTitle(conversation) : "Conversation";
    return (
        <header className="mj_ChatHeader">
            <button
                className="mj_BackButton"
                onClick={() => client.clearSelection()}
                aria-label="Back to conversations"
            >
                <ChevronLeftIcon />
            </button>
            <span className={`mj_Avatar mj_Avatar_${conversation?.session_state ?? "running"}`} aria-hidden="true">
                {conversationInitial(title)}
            </span>
            <div className="mj_ChatHeading">
                <strong>{title}</strong>
            </div>
            <div className="mj_ChatHeaderActions">
                <button
                    className="mj_IconButton"
                    onClick={() => setInfoOpen((open) => !open)}
                    title="Conversation information"
                    aria-label="Conversation information"
                    aria-expanded={infoOpen}
                >
                    <InfoIcon />
                </button>
            </div>
            {infoOpen && (
                <div className="mj_HeaderMenu mj_RoomInfoMenu">
                    <strong>{title}</strong>
                    <span>{conversation?.session_state === "done" ? "Session complete" : "Agent session"}</span>
                    <span className={`mj_ConnectionLabel mj_ConnectionLabel_${state.connection}`}>
                        {state.connection === "online"
                            ? "Connected"
                            : state.connection === "connecting"
                              ? "Connecting…"
                              : "Offline"}
                    </span>
                    <SessionStatusView status={state.sessionStatus} />
                </div>
            )}
        </header>
    );
}

function PromptCard({
    client,
    event,
    answered,
    permission = false,
}: {
    client: MatronJournalClient;
    event: JournalEvent;
    answered: boolean;
    permission?: boolean;
}): React.ReactElement {
    const [freeText, setFreeText] = useState("");
    const [locallyAnswered, setLocallyAnswered] = useState(false);
    const question = permission
        ? asString(event.payload.description, "Permission request")
        : asString(event.payload.question, "The agent needs your input");
    const rawOptions = Array.isArray(event.payload.options)
        ? event.payload.options
        : permission
          ? ["Allow", "Deny"]
          : [];
    const options = rawOptions.map((option) => {
        if (typeof option === "string") return { label: option, value: option };
        if (typeof option === "object" && option) {
            const record = option as EventPayload;
            const label = asString(record.label, asString(record.value, asString(record.id, "Option")));
            return { label, value: asString(record.value, asString(record.id, label)) };
        }
        return { label: String(option), value: String(option) };
    });
    const disabled = answered || locallyAnswered;
    const answer = (choice?: string, text?: string): void => {
        if (client.sendPromptReply(event.seq, choice, text)) setLocallyAnswered(true);
    };

    return (
        <div className="mj_PromptCard">
            <div className="mj_PromptLabel">{permission ? "Permission needed" : "Question"}</div>
            <p>{question}</p>
            {!disabled && options.length > 0 && (
                <div className="mj_PromptOptions">
                    {options.map((option) => (
                        <button key={`${option.label}:${option.value}`} onClick={() => answer(option.value)}>
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
            {!disabled && (event.payload.allows_free_text === true || options.length === 0) && (
                <form
                    className="mj_PromptText"
                    onSubmit={(submitEvent) => {
                        submitEvent.preventDefault();
                        if (freeText.trim()) answer(undefined, freeText.trim());
                    }}
                >
                    <input
                        value={freeText}
                        onChange={(changeEvent) => setFreeText(changeEvent.target.value)}
                        placeholder="Type an answer"
                    />
                    <button type="submit" disabled={!freeText.trim()}>
                        Send
                    </button>
                </form>
            )}
            {disabled && <div className="mj_Answered">✓ Answered</div>}
        </div>
    );
}

function ToolOutput({ client, event }: { client: MatronJournalClient; event: JournalEvent }): React.ReactElement {
    const payload = event.payload;
    const command = asString(payload.command, asString(payload.tool_name, "Tool output"));
    const exitCode = typeof payload.exit_code === "number" ? payload.exit_code : undefined;
    const failed = payload.denied === true || (exitCode !== undefined && exitCode !== 0);
    const expired = payload.expired === true;
    const blobRef = typeof payload.blob_ref === "string" ? payload.blob_ref : undefined;
    const [fullOutput, setFullOutput] = useState<string>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    const load = async (): Promise<void> => {
        if (!blobRef || loading) return;
        setLoading(true);
        setError(undefined);
        try {
            const url = await client.mediaUrl(blobRef);
            const response = await fetch(url);
            setFullOutput(await response.text());
        } catch (loadError) {
            setError(errorMessage(loadError));
        } finally {
            setLoading(false);
        }
    };

    return (
        <details className={`mj_ToolCard ${failed ? "mj_ToolCard_failed" : ""}`}>
            <summary>
                <span aria-hidden="true">{failed ? "!" : "›_"}</span>
                <code>{command.split(/\s+/)[0] || "tool"}</code>
                <span>{failed ? "Failed" : "Completed"}</span>
                {exitCode !== undefined && <span>exit {exitCode}</span>}
            </summary>
            <div className="mj_ToolCommand">
                <code>{command}</code>
            </div>
            {expired ? (
                <div className="mj_Expired">Output expired after 24 hours.</div>
            ) : (
                <>
                    {(fullOutput ?? asString(payload.snippet)) && <pre>{fullOutput ?? asString(payload.snippet)}</pre>}
                    {blobRef && fullOutput === undefined && (
                        <button className="mj_TextButton" onClick={() => void load()} disabled={loading}>
                            {loading ? "Loading…" : "Load full output"}
                        </button>
                    )}
                    {payload.truncated === true && <div className="mj_Muted">Preview truncated</div>}
                    {error && <div className="mj_Error">{error}</div>}
                </>
            )}
        </details>
    );
}

function AuthenticatedMedia({
    client,
    mediaId,
    image,
    filename,
    caption,
}: {
    client: MatronJournalClient;
    mediaId: string;
    image: boolean;
    filename?: string;
    caption?: string;
}): React.ReactElement {
    const [url, setUrl] = useState<string>();
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(false);

    const load = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            setUrl(await client.mediaUrl(mediaId));
        } catch (loadError) {
            setError(errorMessage(loadError));
        } finally {
            setLoading(false);
        }
    }, [client, mediaId]);

    useEffect(() => {
        if (image) void load();
    }, [image, load]);

    if (error) return <div className="mj_Error">{error}</div>;
    if (image) {
        return url ? (
            <figure className="mj_Image">
                <img src={url} alt={caption || "Shared image"} />
                {caption && <figcaption>{caption}</figcaption>}
            </figure>
        ) : (
            <div className="mj_MediaLoading">{loading ? "Loading image…" : "Image"}</div>
        );
    }
    return url ? (
        <a className="mj_File" href={url} download={filename || "attachment"}>
            ↓ {filename || "Download attachment"}
        </a>
    ) : (
        <button className="mj_File" onClick={() => void load()} disabled={loading}>
            ↓ {loading ? "Preparing download…" : filename || "Download attachment"}
        </button>
    );
}

function EventContent({
    client,
    event,
    answeredPrompts,
}: {
    client: MatronJournalClient;
    event: JournalEvent;
    answeredPrompts: Set<number>;
}): React.ReactElement {
    switch (event.type) {
        case "text":
            return <div className="mj_MessageText">{asString(event.payload.body)}</div>;
        case "prompt":
            return <PromptCard client={client} event={event} answered={answeredPrompts.has(event.seq)} />;
        case "permission_request":
            return <PromptCard client={client} event={event} answered={answeredPrompts.has(event.seq)} permission />;
        case "prompt_reply":
            return (
                <div className="mj_MessageText">
                    {asString(event.payload.choice, asString(event.payload.text, "Answered"))}
                </div>
            );
        case "tool_output":
            return <ToolOutput client={client} event={event} />;
        case "diff":
            return (
                <pre className="mj_Diff">
                    {asString(
                        event.payload.diff,
                        asString(event.payload.patch, JSON.stringify(event.payload, null, 2)),
                    )}
                </pre>
            );
        case "image": {
            const mediaId = asString(event.payload.blob_ref);
            return mediaId ? (
                <AuthenticatedMedia client={client} mediaId={mediaId} image caption={asString(event.payload.caption)} />
            ) : (
                <div className="mj_Muted">Image unavailable</div>
            );
        }
        case "file": {
            const mediaId = asString(event.payload.blob_ref);
            return (
                <div>
                    {mediaId ? (
                        <AuthenticatedMedia
                            client={client}
                            mediaId={mediaId}
                            image={false}
                            filename={asString(event.payload.filename, "attachment")}
                        />
                    ) : (
                        <span className="mj_Muted">File unavailable</span>
                    )}
                    {formatBytes(event.payload.size) && (
                        <span className="mj_FileSize">{formatBytes(event.payload.size)}</span>
                    )}
                </div>
            );
        }
        default:
            return (
                <details className="mj_Unknown">
                    <summary>{event.type}</summary>
                    <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                </details>
            );
    }
}

function EventRow({
    client,
    event,
    answeredPrompts,
}: {
    client: MatronJournalClient;
    event: JournalEvent;
    answeredPrompts: Set<number>;
}): React.ReactElement {
    const own = event.sender.startsWith("user:");
    return (
        <article className={`mj_Event ${own ? "mj_Event_own" : "mj_Event_agent"}`}>
            {!own && (
                <span className="mj_EventAvatar" aria-hidden="true">
                    ✦
                </span>
            )}
            <div className="mj_EventColumn">
                {!own && <span className="mj_Sender">{displaySender(event.sender)}</span>}
                <div className="mj_EventBubble">
                    <EventContent client={client} event={event} answeredPrompts={answeredPrompts} />
                </div>
                <time>{formatTime(event.ts)}</time>
            </div>
        </article>
    );
}

function ToolStream({ stream }: { stream: ToolStreamState }): React.ReactElement {
    return (
        <article className="mj_Event mj_Event_agent">
            <span className="mj_EventAvatar" aria-hidden="true">
                ✦
            </span>
            <div className="mj_EventColumn mj_EventColumn_wide">
                <span className="mj_Sender">agent</span>
                <div className="mj_LiveTool">
                    <div>
                        <span className="mj_LiveDot" /> Running <code>{stream.command || stream.tool || "tool"}</code>
                    </div>
                    <pre>{stream.headTruncated ? `… earlier output omitted …\n${stream.content}` : stream.content}</pre>
                </div>
            </div>
        </article>
    );
}

function Timeline({ client, state }: { client: MatronJournalClient; state: ClientState }): React.ReactElement {
    const scrollRef = useRef<HTMLDivElement>(null);
    const visibleEvents = useMemo(
        () =>
            state.events.filter(
                (event) => !["read_marker", "edit", "session_status", "convo_meta"].includes(event.type),
            ),
        [state.events],
    );
    const answeredPrompts = useMemo(
        () =>
            new Set(
                state.events
                    .filter((event) => event.type === "prompt_reply")
                    .map((event) => asNumber(event.payload.target_seq))
                    .filter(Boolean),
            ),
        [state.events],
    );
    const textStreamCount = Object.keys(state.textStreams).length;
    const toolStreamCount = Object.keys(state.toolStreams).length;

    useEffect(() => {
        const node = scrollRef.current;
        if (node) node.scrollTop = node.scrollHeight;
    }, [
        state.selectedConversationId,
        visibleEvents.length,
        state.pendingMessages.length,
        textStreamCount,
        toolStreamCount,
    ]);

    return (
        <div className="mj_Timeline" ref={scrollRef}>
            <div className="mj_TimelineInner">
                {state.hasOlderHistory && (
                    <button
                        className="mj_LoadHistory"
                        onClick={() => void client.loadOlderHistory()}
                        disabled={state.loadingHistory}
                    >
                        {state.loadingHistory ? "Loading…" : "Load earlier messages"}
                    </button>
                )}
                {visibleEvents.length === 0 && !state.loadingHistory && (
                    <div className="mj_EmptyConversation">
                        <span>✦</span>
                        <strong>This conversation is ready.</strong>
                        <p>Send a message to the agent to continue.</p>
                    </div>
                )}
                {visibleEvents.map((event) => (
                    <EventRow key={event.seq} client={client} event={event} answeredPrompts={answeredPrompts} />
                ))}
                {state.pendingMessages.map((message) => (
                    <article className="mj_Event mj_Event_own mj_Event_pending" key={message.localId}>
                        <div className="mj_EventColumn">
                            <div className="mj_EventBubble">
                                <div className="mj_MessageText">{message.body}</div>
                            </div>
                            <span>Sending…</span>
                        </div>
                    </article>
                ))}
                {Object.values(state.textStreams).map((text, index) => (
                    <article className="mj_Event mj_Event_agent" key={`text-stream-${index}`}>
                        <span className="mj_EventAvatar" aria-hidden="true">
                            ✦
                        </span>
                        <div className="mj_EventColumn">
                            <span className="mj_Sender">agent</span>
                            <div className="mj_EventBubble mj_EventBubble_streaming">
                                {text}
                                <span className="mj_Cursor" />
                            </div>
                        </div>
                    </article>
                ))}
                {Object.values(state.toolStreams).map((stream) => (
                    <ToolStream key={stream.messageRef} stream={stream} />
                ))}
                {state.activity && state.activity.state !== "idle" && (
                    <div className="mj_Activity">
                        <span />
                        <span />
                        <span />
                        {state.activity.state === "thinking"
                            ? "Thinking"
                            : `Running ${state.activity.detail || "a tool"}`}
                    </div>
                )}
            </div>
        </div>
    );
}

function Composer({ client, state }: { client: MatronJournalClient; state: ClientState }): React.ReactElement {
    const [body, setBody] = useState("");
    const textarea = useRef<HTMLTextAreaElement>(null);
    const send = async (): Promise<void> => {
        if (await client.sendMessage(body)) {
            setBody("");
            if (textarea.current) textarea.current.style.height = "auto";
        }
    };
    return (
        <footer className="mj_ComposerArea">
            {state.connectionError && (
                <div className="mj_ConnectionError" role="status">
                    {state.connectionError}
                </div>
            )}
            <div className="mj_Composer">
                <textarea
                    ref={textarea}
                    rows={1}
                    value={body}
                    onChange={(event) => {
                        setBody(event.target.value);
                        event.target.style.height = "auto";
                        event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void send();
                        }
                    }}
                    placeholder={
                        state.connection === "online" ? "Send a message…" : "Messages will send when reconnected"
                    }
                    aria-label="Message your agent"
                />
                <button
                    className="mj_ComposerButton"
                    disabled
                    title="Attachments are not supported by this journal server"
                    aria-label="Attach a file"
                >
                    <AttachmentIcon />
                </button>
                {body.trim() && (
                    <button className="mj_SendButton" onClick={() => void send()} aria-label="Send message">
                        <SendIcon />
                    </button>
                )}
            </div>
        </footer>
    );
}

function SignedInApp({ client, state }: { client: MatronJournalClient; state: ClientState }): React.ReactElement {
    return (
        <main className="mj_App">
            <ConversationList client={client} state={state} />
            <section className={`mj_Chat ${state.selectedConversationId ? "" : "mj_Chat_mobileHidden"}`}>
                {state.selectedConversationId ? (
                    <>
                        <ChatHeader client={client} state={state} />
                        <Timeline client={client} state={state} />
                        <Composer client={client} state={state} />
                    </>
                ) : (
                    <div className="mj_NoSelection">
                        <span className="mj_BrandMark" aria-hidden="true">
                            M
                        </span>
                        <h2>Select a conversation</h2>
                        <p>Your agent sessions stay synced across every Matron device.</p>
                    </div>
                )}
            </section>
        </main>
    );
}

export function MatronApp({ client }: { client: MatronJournalClient }): React.ReactElement {
    const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
    if (state.phase === "loading")
        return (
            <div className="mj_Loading">
                <span className="mj_BrandMark">M</span>
            </div>
        );
    if (state.phase === "signed-out") return <LoginScreen client={client} state={state} />;
    return <SignedInApp client={client} state={state} />;
}

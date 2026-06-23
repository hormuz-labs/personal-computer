import {
	ApiOutlined,
	DeleteOutlined,
	EditOutlined,
	GithubOutlined,
	LinkedinOutlined,
	MoonOutlined,
	PlusOutlined,
	RobotOutlined,
	SendOutlined,
	SlackOutlined,
	SunOutlined,
	TwitterOutlined,
	WechatOutlined,
} from "@ant-design/icons";
import { createOpencodeClient } from "@opencode-ai/sdk/client";
import {
	Avatar,
	Button,
	Card,
	Collapse,
	ConfigProvider,
	Divider,
	Form,
	Input,
	Layout,
	List,
	Menu,
	Modal,
	Popconfirm,
	Select,
	Space,
	Spin,
	Switch,
	Tag,
	Typography,
	theme,
} from "antd";
import dayjs from "dayjs";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { BrowserRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";

const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
const OPENCODE_BASE_URL =
	import.meta.env.VITE_OPENCODE_BASE_URL || "http://localhost:4096";

const client = createOpencodeClient({
	baseUrl: OPENCODE_BASE_URL,
});

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const parseMessageContent = (text: string) => {
	if (!text) return { text: "", thinkText: null };

	let mainText = "";
	const thinkParts: string[] = [];
	let lastIndex = 0;

	// Regex to find <think>...</think> or <think>... (unclosed at the end of string)
	const regex = /<think>([\s\S]*?)(<\/think>|$)/g;
	let match;

	while ((match = regex.exec(text)) !== null) {
		// Add text before <think> to mainText
		mainText += text.substring(lastIndex, match.index);
		
		// Add captured think content to thinkParts
		if (match[1].trim()) {
			thinkParts.push(match[1].trim());
		}
		
		lastIndex = regex.lastIndex;
		
		// Avoid infinite loop if regex.lastIndex doesn't progress
		if (match.index === regex.lastIndex) {
			regex.lastIndex++;
		}
	}
	
	// Add any remaining text after the last match
	mainText += text.substring(lastIndex);

	return {
		text: mainText.trim(),
		thinkText: thinkParts.length > 0 ? thinkParts.join("\n\n") : null
	};
};

const AppContent: React.FC<{
	isDarkMode: boolean;
	setIsDarkMode: (val: boolean) => void;
}> = ({ isDarkMode, setIsDarkMode }) => {
	const { token } = theme.useToken();
	const { agentId: agentIdParam } = useParams<{ agentId: string }>();
	const navigate = useNavigate();
	const [agents, setAgents] = useState<any[]>([]);
	const [activeAgentId, setActiveAgentId] = useState<string | null>(agentIdParam || null);

	const setActiveAgent = (id: string | null) => {
		setActiveAgentId(id);
		if (id) {
			navigate(`/agent/${id}`, { replace: true });
		} else {
			navigate("/", { replace: true });
		}
	};

	const [agentSessions, setAgentSessions] = useState<Record<string, string>>(
		{},
	);
	const agentSessionsRef = useRef<Record<string, string>>({});
	const [chatHistories, setChatHistories] = useState<Record<string, any[]>>({});
	const chatHistoriesRef = useRef<Record<string, any[]>>({});
	// Track pending (in-flight) message IDs per agent to know when streaming completes
	const pendingMessageRef = useRef<Record<string, string | null>>({});

	const [tasks, setTasks] = useState<any[]>([]);
	const [availableModels, setAvailableModels] = useState<
		{ id: string; name: string }[]
	>([]);

	const [chatInput, setChatInput] = useState("");
	const [isConnected, setIsConnected] = useState(false);
	const [isTyping, setIsTyping] = useState(false);
	const chatEndRef = useRef<HTMLDivElement>(null);

	const [isAddAgentModalVisible, setIsAddAgentModalVisible] = useState(false);
	const [isScheduleTaskModalVisible, setIsScheduleTaskModalVisible] =
		useState(false);
	const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

	const [agentForm] = Form.useForm();
	const [taskForm] = Form.useForm();

	const fetchAgents = async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/agents`);
			if (response.ok) {
				const data = await response.json();

				const agentsWithIcons = data.map((a: any) => {
					let icon = <RobotOutlined />;
					switch (a.type) {
						case "slack":
							icon = <SlackOutlined />;
							break;
						case "discord":
							icon = <WechatOutlined />;
							break;
						case "linkedin":
							icon = <LinkedinOutlined />;
							break;
						case "twitter":
							icon = <TwitterOutlined />;
							break;
						case "github":
							icon = <GithubOutlined />;
							break;
					}
					return { ...a, icon };
				});

				setAgents(agentsWithIcons);

				// Restore persisted sessions from DB
				const restoredSessions: Record<string, string> = {};
				agentsWithIcons.forEach((a: any) => {
					if (a.session_id) restoredSessions[a.id] = a.session_id;
				});
				if (Object.keys(restoredSessions).length > 0) {
					agentSessionsRef.current = { ...agentSessionsRef.current, ...restoredSessions };
					setAgentSessions((prev) => ({ ...prev, ...restoredSessions }));
				}

				// If URL has an agent ID, use it; otherwise default to first agent
				const urlAgentId = agentIdParam;
				const matchedAgent = urlAgentId
					? agentsWithIcons.find((a: any) => a.id === urlAgentId)
					: null;
				if (matchedAgent) {
					setActiveAgentId(matchedAgent.id);
				} else if (agentsWithIcons.length > 0 && !activeAgentId) {
					setActiveAgent(agentsWithIcons[0].id);
				}
			}
		} catch (error) {
			console.error("Failed to fetch agents:", error);
		}
	};

	useEffect(() => {
		agentSessionsRef.current = agentSessions;
	}, [agentSessions]);

	useEffect(() => {
		chatHistoriesRef.current = chatHistories;
	}, [chatHistories]);

	useEffect(() => {
		const abortController = new AbortController();

		fetchAgents();

		client.session
			.list()
			.then(() => {
				setIsConnected(true);

				client.event
					.subscribe({ signal: abortController.signal } as any)
					.then((events) => {
						(async () => {
							for await (const ev of events.stream) {
								if (abortController.signal.aborted) break;
								const raw = ev as any;
								const event = { type: raw.type, ...(raw.properties || raw) } as any;
								if (!event.sessionID) continue;

								const sessions = agentSessionsRef.current;
								const agentId = Object.keys(sessions).find(
									(k) => sessions[k] === event.sessionID,
								);
								if (!agentId) continue;

								// Derive messageID based on event type
								let messageID: string | undefined;
								if (event.type === "message.updated") {
									messageID = event.info?.id;
								} else if (event.type === "message.part.updated") {
									messageID = event.part?.messageID;
								} else if (event.type === "message.part.delta") {
									messageID = event.messageID;
								}

								// Clear isTyping when assistant message completes
								if (
									event.type === "message.updated" &&
									event.info?.role === "assistant" &&
									event.info?.finish
								) {
									setIsTyping(false);
									pendingMessageRef.current[agentId] = null;
								}

								if (!messageID) continue;

								setChatHistories((prev) => {
									const history = prev[agentId] || [];

									// message.updated — create or update message metadata
									if (event.type === "message.updated" && event.info) {
										const role = event.info.role;
										// Skip user messages — they're added optimistically in handleSendMessage
										if (role === "user") return prev;

										const existingIndex = history.findIndex((m: any) => m.id === messageID);
										if (existingIndex === -1) {
											// New assistant message
											const newMsg = {
												id: messageID,
												sender: "agent",
												text: "",
												thinkText: null,
												time: dayjs(event.info.time?.created).format("hh:mm A"),
												parts: [],
												rawText: "",
											};
											setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
											return { ...prev, [agentId]: [...history, newMsg] };
										}
										return prev;
									}

									// message.part.updated — upsert part into existing message
								if (event.type === "message.part.updated" && event.part) {
									const existingIndex = history.findIndex((m: any) => m.id === messageID);
									if (existingIndex === -1) return prev;

									const msg = { ...history[existingIndex], parts: [...(history[existingIndex].parts || [])] };
									const partIndex = msg.parts.findIndex((p: any) => p.id === event.part.id);
									if (partIndex === -1) {
										msg.parts.push(event.part);
									} else {
										// Always overwrite with server version (corrects type if delta created it wrong)
										msg.parts[partIndex] = { ...event.part };
									}

									const reasoningText = msg.parts.filter((p: any) => p.type === "reasoning" && p.text).map((p: any) => p.text).join("\n");
									const normalText = msg.parts.filter((p: any) => p.type === "text" && p.text).map((p: any) => p.text).join("");
									const parsed = parseMessageContent(normalText);
									msg.thinkText = reasoningText || parsed.thinkText;
									msg.text = parsed.text;

									const newHistory = [...history];
									newHistory[existingIndex] = msg;
									return { ...prev, [agentId]: newHistory };
								}

								// message.part.delta — append delta to text or reasoning parts only
								if (event.type === "message.part.delta" && event.field === "text") {
									const existingIndex = history.findIndex((m: any) => m.id === messageID);
									if (existingIndex === -1) return prev;

									const msg = { ...history[existingIndex], parts: [...(history[existingIndex].parts || [])] };
									const partIndex = msg.parts.findIndex((p: any) => p.id === event.partID);

									if (partIndex === -1) {
										// Part not yet seen — create on-the-fly as "text".
										// If it's actually "reasoning", it will be corrected when message.part.updated arrives.
										msg.parts.push({ id: event.partID, type: "text", text: event.delta });
									} else {
										const existingPart = msg.parts[partIndex];
										// Only accumulate deltas for text and reasoning parts — ignore tool/step-*/etc.
										if (existingPart.type !== "text" && existingPart.type !== "reasoning") {
											return prev;
										}
										msg.parts[partIndex] = { ...existingPart, text: (existingPart.text || "") + event.delta };
									}

									const reasoningText = msg.parts.filter((p: any) => p.type === "reasoning" && p.text).map((p: any) => p.text).join("\n");
									const normalText = msg.parts.filter((p: any) => p.type === "text" && p.text).map((p: any) => p.text).join("");
									const parsed = parseMessageContent(normalText);
									msg.thinkText = reasoningText || parsed.thinkText;
									msg.text = parsed.text;

									const newHistory = [...history];
									newHistory[existingIndex] = msg;
									setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
									return { ...prev, [agentId]: newHistory };
								}


									return prev;
								});
							}
						})();
					})
					.catch(console.error);
			})
			.catch((err) => {
				console.error("Opencode connection failed:", err);
				setIsConnected(false);
			});

		client.config
			.providers()
			.then((res) => {
				if (res.data?.providers) {
					const models: { id: string; name: string }[] = [];
					res.data.providers.forEach((p: any) => {
						if (p.models) {
							Object.values(p.models).forEach((m: any) => {
								models.push({ id: m.id, name: m.name || m.id });
							});
						}
					});
					setAvailableModels(models);
				}
			})
			.catch((err) => console.error("Failed to fetch models:", err));

		return () => {
			abortController.abort();
		};
	}, []);

	const loadSessionMessages = async (sessionId: string, agentId: string) => {
		try {
			const agent = agents.find((a) => a.id === agentId);
			const persona = agent?.systemPrompt || null;

			const res = await client.session.messages({ path: { id: sessionId } });
			if (res.data) {
				const formatted = res.data
					.filter((msg: any) => !msg.info.noReply && msg.parts?.length > 0)
					.map((msg: any) => {
					const reasoningText = msg.parts
						.filter((p: any) => p.type === "reasoning" && p.text)
						.map((p: any) => p.text)
						.join("\n");
					const normalText = msg.parts
						.filter((p: any) => p.type === "text" && p.text)
						.map((p: any) => p.text)
						.join("");

						const parsed = parseMessageContent(normalText);
						const text = parsed.text;
						const thinkText = reasoningText || parsed.thinkText || null;
						const rawText = msg.parts.map((p: any) => p.text).join("\n");

					return {
						id: msg.info.id,
						sender: msg.info.role === "user" ? "user" : "agent",
						text,
						thinkText,
						time: msg.info.time?.created
							? dayjs(msg.info.time.created).format("hh:mm A")
							: "",
						rawText,
					};
					})
					.filter((msg: any) => {
						if (!msg.text && !msg.thinkText) return false;
						if (
							msg.sender === "user" &&
							persona &&
							msg.rawText.trim() === persona.trim()
						)
							return false;
						return true;
					});

				setChatHistories((prev) => {
				// Merge: keep any optimistic messages not yet in loaded history
				const existing = prev[agentId] || [];
				const loadedIds = new Set(formatted.map((m: any) => m.id));
				const optimistic = existing.filter((m: any) => !loadedIds.has(m.id));
				return { ...prev, [agentId]: [...formatted, ...optimistic] };
			});
				setTimeout(
					() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
					100,
				);
			}
		} catch (e) {
			console.error(e);
		}
	};

	const fetchTasks = async (agentId: string) => {
		try {
			const response = await fetch(`${API_BASE_URL}/agents/${agentId}/tasks`);
			if (response.ok) {
				const data = await response.json();
				setTasks(data);
			}
		} catch (error) {
			console.error("Failed to fetch tasks:", error);
		}
	};

	useEffect(() => {
		if (!activeAgentId) return;
		fetchTasks(activeAgentId);
		const sessionId = agentSessions[activeAgentId];
		// Don't reload messages if there's already a pending message in flight
		if (sessionId && !pendingMessageRef.current[activeAgentId]) {
			loadSessionMessages(sessionId, activeAgentId);
		} else {
			setTimeout(
				() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
				100,
			);
		}
	}, [activeAgentId, agentSessions]);

	const handleAddAgent = async (values: any) => {
		const isEditing = !!editingAgentId;
		const agentId = isEditing ? editingAgentId : `a${Date.now()}`;

		const payload = {
			id: agentId,
			name: values.name,
			role: values.role,
			type: values.type,
			description: values.description,
			systemPrompt: values.systemPrompt,
			model: values.model || "big-pickle",
			temperature: values.temperature || 0.7,
			maxTokens: values.maxTokens || 4096,
			apiEndpoint: values.apiEndpoint,
		};

		try {
			const method = isEditing ? "PUT" : "POST";
			const url = isEditing
				? `${API_BASE_URL}/agents/${agentId}`
				: `${API_BASE_URL}/agents`;

			const response = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (response.ok) {
				await fetchAgents();
				if (!isEditing) setActiveAgent(agentId);
				setIsAddAgentModalVisible(false);
				setEditingAgentId(null);
				agentForm.resetFields();
			}
		} catch (error) {
			console.error("Failed to save agent:", error);
		}
	};

	const handleDeleteAgent = async (id: string) => {
		try {
			const response = await fetch(`${API_BASE_URL}/agents/${id}`, {
				method: "DELETE",
			});
			if (response.ok) {
				await fetchAgents();
				if (activeAgentId === id) {
					setActiveAgent(null);
				}
			}
		} catch (error) {
			console.error("Failed to delete agent:", error);
		}
	};

	const openEditModal = (agent: any) => {
		setEditingAgentId(agent.id);
		agentForm.setFieldsValue({
			name: agent.name,
			role: agent.role,
			type: agent.type,
			description: agent.description,
			systemPrompt: agent.systemPrompt || "",
			model: agent.model || "big-pickle",
			temperature: agent.temperature || 0.7,
			maxTokens: agent.maxTokens || 4096,
			apiEndpoint: agent.apiEndpoint || "",
		});
		setIsAddAgentModalVisible(true);
	};

	const handleScheduleTask = async (values: any) => {
		if (!activeAgentId) return;

		try {
			const response = await fetch(
				`${API_BASE_URL}/agents/${activeAgentId}/tasks`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						text: values.task,
						schedule_time: values.time,
						active: true,
					}),
				},
			);

			if (response.ok) {
				const newTask = await response.json();
				setTasks((prev) => [...prev, newTask]);
			}
		} catch (error) {
			console.error("Failed to save task:", error);
		}

		setIsScheduleTaskModalVisible(false);
		taskForm.resetFields();

		const currentAgent = agents.find((a) => a.id === activeAgentId);
		if (!currentAgent || !isConnected) return;

		try {
			const sessionId = await getOrCreateSession(currentAgent);
			if (!sessionId) return;

			client.session
				.prompt({
					path: { id: sessionId },
					body: {
						parts: [
							{
								type: "text",
								text: `Please schedule this task: ${values.task} at ${values.time}`,
							},
						],
					},
				})
				.catch(console.error);
		} catch (err) {
			console.error("Failed to trigger scheduled task prompt:", err);
		}
	};

	const getOrCreateSession = async (agent: any) => {
		if (agentSessionsRef.current[agent.id]) {
			return agentSessionsRef.current[agent.id];
		}

		// Restore from DB if available
		if (agent.session_id) {
			agentSessionsRef.current[agent.id] = agent.session_id;
			setAgentSessions((prev) => ({ ...prev, [agent.id]: agent.session_id }));
			return agent.session_id;
		}

		try {
			const res = await client.session.create({
				body: { title: `Chat with ${agent.name}` },
			});
			if (res.data) {
				const sessionId = res.data.id;

				if (agent.systemPrompt) {
					await client.session.prompt({
						path: { id: sessionId },
						body: {
							noReply: true,
							parts: [{ type: "text", text: agent.systemPrompt }],
						},
					});
				}

				// Persist session_id to DB
				fetch(`${API_BASE_URL}/agents/${agent.id}/session`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ session_id: sessionId }),
				}).catch(console.error);

				agentSessionsRef.current[agent.id] = sessionId;
				setAgentSessions((prev) => ({ ...prev, [agent.id]: sessionId }));
				return sessionId;
			}
		} catch (err) {
			console.error("Failed to create session:", err);
		}
		return null;
	};

	const handleSendMessage = async () => {
		if (!chatInput.trim()) return;
		const userText = chatInput;
		setChatInput("");

		const currentAgent = agents.find((a) => a.id === activeAgentId);
		if (!currentAgent) return;

		if (!activeAgentId) return;
		const tempId = Date.now();
		setChatHistories((prev) => ({
			...prev,
			[activeAgentId]: [
				...(prev[activeAgentId] || []),
				{
					id: tempId,
					sender: "user",
					text: userText,
					time: dayjs().format("hh:mm A"),
				},
			],
		}));
		setIsTyping(true);
		setTimeout(
			() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
			100,
		);

		if (!isConnected) {
			setTimeout(() => {
				setChatHistories((prev) => ({
					...prev,
					[activeAgentId]: [
						...(prev[activeAgentId] || []),
						{
							id: Date.now(),
							sender: "agent",
							text: `(Offline Mock) Received: ${userText}`,
							time: dayjs().format("hh:mm A"),
						},
					],
				}));
				setIsTyping(false);
				setTimeout(
					() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
					100,
				);
			}, 1000);
			return;
		}

		try {
			const sessionId = await getOrCreateSession(currentAgent);
			if (!sessionId) throw new Error("No session");

			// Mark pending — isTyping will be cleared when message.updated arrives
			pendingMessageRef.current[activeAgentId] = "pending";

			client.session.prompt({
				path: { id: sessionId },
				body: {
					parts: [{ type: "text", text: userText }],
				},
			}).then((result) => {
				// Store the assistant message ID so we can match the completion event
				const assistantMessageId = (result as any)?.data?.info?.id || (result as any)?.data?.id;
				if (assistantMessageId) {
					pendingMessageRef.current[activeAgentId] = assistantMessageId;
				}
			}).catch((error) => {
				console.error("Error sending message:", error);
				setIsTyping(false);
				pendingMessageRef.current[activeAgentId] = null;
			});
		} catch (error) {
			console.error("Error sending message:", error);
			setIsTyping(false);
			pendingMessageRef.current[activeAgentId] = null;
		}
	};

	const currentAgentData = agents.find((a) => a.id === activeAgentId);
	const activeChat = activeAgentId ? chatHistories[activeAgentId] || [] : [];

	const menuItems = agents.map((agent) => ({
		key: agent.id,
		icon: agent.icon,
		label: agent.name,
	}));

	return (
		<Layout style={{ height: "100vh", overflow: "hidden" }}>
			<Sider
				width={250}
				style={{
					background: token.colorBgContainer,
					borderRight: `1px solid ${token.colorBorder}`,
					height: "100vh",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<div
					style={{
						padding: "16px",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						borderBottom: `1px solid ${token.colorBorder}`,
						flexShrink: 0,
					}}
				>
					<Title level={5} style={{ margin: 0 }}>
						Opencode Agents
					</Title>
					<Button
						type="primary"
						shape="circle"
						icon={<PlusOutlined />}
						size="small"
						onClick={() => setIsAddAgentModalVisible(true)}
					/>
				</div>
				<div style={{ flex: 1, overflowY: "auto" }}>
					<Menu
						mode="inline"
						selectedKeys={activeAgentId ? [activeAgentId] : []}
						items={menuItems}
						onClick={(e) => setActiveAgent(e.key)}
						style={{ borderRight: 0, background: "transparent" }}
					/>
				</div>
			</Sider>

			<Layout
				style={{
					height: "100vh",
					overflow: "hidden",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<Header
					style={{
						background: token.colorBgContainer,
						padding: "0 24px",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						borderBottom: `1px solid ${token.colorBorder}`,
						height: "64px",
						flexShrink: 0,
					}}
				>
					<Space size="middle">
						<Avatar
							style={{ backgroundColor: token.colorPrimary }}
							icon={currentAgentData?.icon}
						/>
						<Title level={5} style={{ margin: 0 }}>
							{currentAgentData?.name || "Select an Agent"}
						</Title>
						{!isConnected && (
							<Tag color="error" icon={<ApiOutlined />}>
								SDK Disconnected (Mock Mode)
							</Tag>
						)}
					</Space>
					<Space>
						<Switch
							checkedChildren={<MoonOutlined />}
							unCheckedChildren={<SunOutlined />}
							checked={isDarkMode}
							onChange={setIsDarkMode}
						/>
					</Space>
				</Header>

				<Content
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						background: token.colorBgLayout,
						overflow: "hidden",
					}}
				>
					<div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
						{currentAgentData ? (
							<>
							<List
								dataSource={activeChat.filter((msg: any) => {
									if (msg.sender === "user") return !!msg.text;
									return !!(msg.text || msg.thinkText);
								})}
								renderItem={(msg: any) => (
										<div
											style={{
												display: "flex",
												gap: "16px",
												marginBottom: "24px",
												justifyContent:
													msg.sender === "user" ? "flex-end" : "flex-start",
											}}
										>
											{msg.sender === "agent" && (
												<Avatar
													style={{ backgroundColor: token.colorPrimary }}
													icon={currentAgentData.icon}
												/>
											)}
											<div
												style={{
													maxWidth: "70%",
													display: "flex",
													flexDirection: "column",
													alignItems:
														msg.sender === "user" ? "flex-end" : "flex-start",
												}}
											>
												<Space style={{ marginBottom: "4px" }}>
													<Text strong>
														{msg.sender === "agent"
															? currentAgentData.name
															: "You"}
													</Text>
													{msg.time && (
														<Text type="secondary" style={{ fontSize: "12px" }}>
															{msg.time}
														</Text>
													)}
												</Space>
												<div
													style={{
														background:
															msg.sender === "user"
																? token.colorPrimary
																: token.colorBgContainer,
														color:
															msg.sender === "user" ? "#fff" : token.colorText,
														padding: "12px 16px",
														borderRadius: "8px",
														border:
															msg.sender === "agent"
																? `1px solid ${token.colorBorder}`
																: "none",
													}}
												>
													{msg.sender === "agent" ? (
														<div
															className="markdown-body"
															style={{ color: "inherit" }}
														>
															{msg.thinkText && (
																<Collapse
																	size="small"
																	ghost
																	items={[
																		{
																			key: "1",
																			label: (
																				<Text
																					type="secondary"
																					style={{
																						fontStyle: "italic",
																						fontSize: "12px",
																					}}
																				>
																					Thinking Process
																				</Text>
																			),
																			children: (
																				<Text
																					type="secondary"
																					style={{
																						whiteSpace: "pre-wrap",
																						fontSize: "12px",
																						fontStyle: "italic",
																					}}
																				>
																					{msg.thinkText}
																				</Text>
																			),
																		},
																	]}
																	style={{
																		marginBottom: msg.text ? "12px" : "0",
																		background: token.colorBgLayout,
																		borderRadius: "6px",
																	}}
																/>
															)}
															{msg.text && (
																<ReactMarkdown remarkPlugins={[remarkGfm]}>
																	{msg.text}
																</ReactMarkdown>
															)}
														</div>
													) : (
														<Text
															style={{
																color: "inherit",
																whiteSpace: "pre-wrap",
															}}
														>
															{msg.text}
														</Text>
													)}
												</div>
											</div>
											{msg.sender === "user" && (
												<Avatar style={{ backgroundColor: token.colorWarning }}>
													U
												</Avatar>
											)}
										</div>
									)}
								/>
								{(isTyping || activeChat.some((m: any) => m.sender === "agent" && !m.text && !m.thinkText)) && (
									<div
										style={{
											display: "flex",
											gap: "16px",
											marginBottom: "24px",
										}}
									>
										<Avatar
											style={{ backgroundColor: token.colorPrimary }}
											icon={currentAgentData.icon}
										/>
										<div
											style={{
												background: token.colorBgContainer,
												padding: "12px 16px",
												borderRadius: "8px",
												border: `1px solid ${token.colorBorder}`,
											}}
										>
											<Spin size="small" />
										</div>
									</div>
								)}
								<div ref={chatEndRef} />
							</>
						) : (
							<div
								style={{
									height: "100%",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Text type="secondary">
									Select or create an agent to start interacting
								</Text>
							</div>
						)}
					</div>

					{currentAgentData && (
						<div
							style={{
								padding: "16px 24px",
								background: token.colorBgContainer,
								borderTop: `1px solid ${token.colorBorder}`,
								flexShrink: 0,
							}}
						>
							<Input
								size="large"
								placeholder={`Message ${currentAgentData.name}...`}
								value={chatInput}
								onChange={(e) => setChatInput(e.target.value)}
								onPressEnter={handleSendMessage}
								suffix={
									<Button
										type="primary"
										icon={<SendOutlined />}
										onClick={handleSendMessage}
										disabled={!chatInput.trim() || isTyping}
									/>
								}
							/>
						</div>
					)}
				</Content>
				<Modal
					title="Schedule Task / Reminder"
					open={isScheduleTaskModalVisible}
					onCancel={() => setIsScheduleTaskModalVisible(false)}
					onOk={() => taskForm.submit()}
					okText="Save"
				>
					<Form form={taskForm} layout="vertical" onFinish={handleScheduleTask}>
						<Form.Item
							name="task"
							label="Task Instruction"
							rules={[{ required: true }]}
						>
							<Input.TextArea
								placeholder="What should the agent do?"
								rows={3}
							/>
						</Form.Item>
						<Form.Item name="time" label="Schedule Pattern or Time">
							<Input placeholder="e.g., Every weekday at 9am" />
						</Form.Item>
					</Form>
				</Modal>
			</Layout>

			{currentAgentData && (
				<Sider
					width={300}
					style={{
						background: token.colorBgContainer,
						borderLeft: `1px solid ${token.colorBorder}`,
						height: "100vh",
						overflowY: "auto",
					}}
				>
					<div style={{ padding: "24px", textAlign: "center" }}>
						<Avatar
							size={80}
							style={{
								backgroundColor: token.colorPrimary,
								marginBottom: "16px",
							}}
							icon={currentAgentData.icon}
						/>
						<Title level={4} style={{ margin: 0 }}>
							{currentAgentData.name}
						</Title>
						<Text type="secondary">{currentAgentData.role}</Text>
						<div
							style={{
								marginTop: "16px",
								display: "flex",
								justifyContent: "center",
								gap: "8px",
							}}
						>
							<Button
								size="small"
								icon={<EditOutlined />}
								onClick={() => openEditModal(currentAgentData)}
							>
								Edit
							</Button>
							<Popconfirm
								title="Delete this agent?"
								onConfirm={() => handleDeleteAgent(currentAgentData.id)}
							>
								<Button size="small" danger icon={<DeleteOutlined />}>
									Delete
								</Button>
							</Popconfirm>
						</div>
					</div>

					<Divider style={{ margin: 0 }} />

					<div style={{ padding: "24px" }}>
						<Title
							level={5}
							style={{
								fontSize: "12px",
								textTransform: "uppercase",
								color: token.colorTextSecondary,
							}}
						>
							Description
						</Title>
						<Card
							size="small"
							bordered={false}
							style={{ background: token.colorBgLayout, marginBottom: "24px" }}
						>
							<Text>{currentAgentData.description}</Text>
						</Card>

						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "16px",
							}}
						>
							<Title
								level={5}
								style={{
									fontSize: "12px",
									textTransform: "uppercase",
									color: token.colorTextSecondary,
									margin: 0,
								}}
							>
								Scheduled Tasks
							</Title>
							<Button
								type="link"
								size="small"
								icon={<PlusOutlined />}
								onClick={() => setIsScheduleTaskModalVisible(true)}
							>
								Add
							</Button>
						</div>

						<List
							size="small"
							dataSource={tasks}
							renderItem={(item) => (
								<List.Item>
									<Space>
										<div
											style={{
												width: "8px",
												height: "8px",
												borderRadius: "50%",
												background: item.active
													? token.colorSuccess
													: token.colorTextQuaternary,
											}}
										/>
										<Text>{item.text}</Text>
									</Space>
								</List.Item>
							)}
						/>
					</div>
				</Sider>
			)}

			<Modal
				title={editingAgentId ? "Edit Agent" : "Create New Agent"}
				open={isAddAgentModalVisible}
				onCancel={() => {
					setIsAddAgentModalVisible(false);
					setEditingAgentId(null);
					agentForm.resetFields();
				}}
				onOk={() => agentForm.submit()}
				okText={editingAgentId ? "Save Changes" : "Create Agent"}
				width={600}
			>
				<Form form={agentForm} layout="vertical" onFinish={handleAddAgent}>
					<div style={{ display: "flex", gap: 16 }}>
						<Form.Item
							name="name"
							label="Agent Name"
							rules={[{ required: true }]}
							style={{ flex: 1 }}
						>
							<Input placeholder="e.g., Tariq Anwar" />
						</Form.Item>
						<Form.Item
							name="role"
							label="Role"
							rules={[{ required: true }]}
							style={{ flex: 1 }}
						>
							<Input placeholder="e.g., Support Assistant" />
						</Form.Item>
					</div>

					<div style={{ display: "flex", gap: 16 }}>
						<Form.Item
							name="type"
							label="Integration Type"
							rules={[{ required: true }]}
							style={{ flex: 1 }}
						>
							<Select placeholder="Select Platform">
								<Select.Option value="slack">Slack</Select.Option>
								<Select.Option value="discord">Discord</Select.Option>
								<Select.Option value="linkedin">LinkedIn</Select.Option>
								<Select.Option value="twitter">Twitter / X</Select.Option>
								<Select.Option value="github">GitHub</Select.Option>
								<Select.Option value="custom">
									Custom Web Interface
								</Select.Option>
							</Select>
						</Form.Item>
						<Form.Item
							name="apiEndpoint"
							label="Target URL/Endpoint"
							style={{ flex: 1 }}
						>
							<Input placeholder="https://..." />
						</Form.Item>
					</div>

					<div style={{ display: "flex", gap: 16 }}>
						<Form.Item
							name="model"
							label="LLM Model"
							style={{ flex: 2 }}
							initialValue="big-pickle"
						>
							<Select
								showSearch
								placeholder="Select an LLM model"
								optionFilterProp="children"
								filterOption={(input, option) =>
									(option?.children as unknown as string)
										.toLowerCase()
										.includes(input.toLowerCase())
								}
							>
								{availableModels.map((model) => (
									<Select.Option key={model.id} value={model.id}>
										{model.name}
									</Select.Option>
								))}
							</Select>
						</Form.Item>
						<Form.Item
							name="temperature"
							label="Temperature"
							style={{ flex: 1 }}
							initialValue={0.7}
						>
							<Input type="number" step={0.1} min={0} max={1} />
						</Form.Item>
					</div>

					<Form.Item
						name="description"
						label="Public Description"
						rules={[{ required: true }]}
					>
						<Input.TextArea
							placeholder="Briefly describe what this agent does..."
							rows={2}
							style={{ resize: "none" }}
						/>
					</Form.Item>

					<Form.Item
						name="systemPrompt"
						label="System Prompt (Hidden Instructions)"
					>
						<Input.TextArea
							placeholder="You are an expert at... Your rules are: 1. Do not..."
							rows={4}
							style={{ resize: "vertical" }}
						/>
					</Form.Item>
				</Form>
			</Modal>
		</Layout>
	);
};

const App: React.FC = () => {
	const [isDarkMode, setIsDarkMode] = useState(true);

	return (
		<BrowserRouter>
			<ConfigProvider
				theme={{
					algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
					token: {
						colorPrimary: "#1677ff",
						borderRadius: 6,
					},
				}}
			>
				<Routes>
					<Route
						path="/agent/:agentId"
						element={
							<AppContent isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
						}
					/>
					<Route
						path="*"
						element={
							<AppContent isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
						}
					/>
				</Routes>
			</ConfigProvider>
		</BrowserRouter>
	);
};

export default App;

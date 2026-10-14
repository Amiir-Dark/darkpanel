export const AdminRole = {
	Standard: "standard",
	Reseller: "reseller",
	Sudo: "sudo",
	FullAccess: "full_access",
};

export const AdminStatus = {
	Active: "active",
	Disabled: "disabled",
	Deleted: "deleted",
};

export const AdminTrafficLimitMode = {
	UsedTraffic: "used_traffic",
	CreatedTraffic: "created_traffic",
};

export const UserPermissionToggle = {
	Create: "create",
	Delete: "delete",
	ResetUsage: "reset_usage",
	PeriodicUsageReset: "periodic_usage_reset",
	Revoke: "revoke",
	CreateOnHold: "create_on_hold",
	AllowUnlimitedData: "allow_unlimited_data",
	AllowUnlimitedExpire: "allow_unlimited_expire",
	AllowNextPlan: "allow_next_plan",
	AdvancedActions: "advanced_actions",
	SetFlow: "set_flow",
	AllowCustomKey: "allow_custom_key",
};

export const AdminManagementPermission = {
	View: "can_view",
	Edit: "can_edit",
	ManageSudo: "can_manage_sudo",
	ManageSessions: "manage_sessions",
	Manage2FA: "manage_2fa",
};

export const AdminSection = {
	Usage: "usage",
	Admins: "admins",
	Services: "services",
	Hosts: "hosts",
	Nodes: "nodes",
	Integrations: "integrations",
	Xray: "xray",
};

export const SelfPermissionToggle = {
	SelfMyAccount: "self_myaccount",
	SelfChangePassword: "self_change_password",
	SelfApiKeys: "self_api_keys",
	SelfSessions: "self_sessions",
	Self2FA: "self_2fa",
	SelfPlaceholders: "self_placeholders",
	SelfSubscription: "self_subscription",
};

export const AdminSudoScope = {
	Nodes: "nodes",
	Xray: "xray",
	Settings: "settings",
	Subscriptions: "subscriptions",
	Backups: "backups",
	Maintenance: "maintenance",
	PHPMyAdmin: "phpmyadmin",
};

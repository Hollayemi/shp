import React from "react";
import { OverviewIcon } from "./OverviewIcon";
import { DatabaseTableIcon } from "./DatabaseTableIcon";
import { RocketIcon, Globe, Cloud, Users, Database, FunctionSquare, Settings, ScrollText, Activity, CreditCard } from "lucide-react";

interface DatabaseIconProps {
    category:
        | "overview"
        | "database"
        | "deployment"
        | "domains"
        | "convex"
        | "convex-data"
        | "convex-files"
        | "convex-functions"
        | "convex-logs"
        | "convex-health"
        | "convex-env"
        | "convex-auth"
        | "users"
        | "shipper-cloud-billing";
}

export function DatabaseIcon({ category }: DatabaseIconProps) {
    const containerClass =
        "flex items-center justify-center w-8 h-8 rounded-md text-[#111827] dark:text-[#F5F9F7]";

    return (
        <div className={containerClass}>
            {category === "overview" && <OverviewIcon />}
            {category === "deployment" && <RocketIcon className="h-5 w-5" />}
            {category === "domains" && <Globe className="h-5 w-5" />}
            {category === "database" && <DatabaseTableIcon />}
            {category === "convex" && <Cloud className="h-5 w-5" />}
            {category === "convex-data" && <Database className="h-5 w-5" />}
            {category === "convex-files" && <Cloud className="h-5 w-5" />}
            {category === "convex-functions" && <FunctionSquare className="h-5 w-5" />}
            {category === "convex-logs" && <ScrollText className="h-5 w-5" />}
            {category === "convex-health" && <Activity className="h-5 w-5" />}
            {category === "convex-env" && <Settings className="h-5 w-5" />}
            {category === "convex-auth" && <Users className="h-5 w-5" />}
            {category === "users" && <Users className="h-5 w-5" />}
            {category === "shipper-cloud-billing" && <CreditCard className="h-5 w-5" />}
        </div>
    );
}

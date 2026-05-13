export const SALES_TEAM = {
    "Sales Executives": [25, 29, 133],
    "Telly Sales": [113, 115, 167, 203],
} as const;

export type DepartmentName = keyof typeof SALES_TEAM;

export default function getDepartmentByUserId(userId: string | number): DepartmentName | null {
    const normalizedUserId = String(userId);

    for (const department of Object.keys(SALES_TEAM) as DepartmentName[]) {
        const ids = SALES_TEAM[department];
        if (ids.some((id) => String(id) === normalizedUserId)) {
            return department;
        }
    }

    return null;
}

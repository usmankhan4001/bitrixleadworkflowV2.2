export const SALES_TEAM = {
    "Sales Executives": [25, 29, 133],
    "Telly Sales": [113, 115, 167, 203],
} as const;

export type DepartmentName = keyof typeof SALES_TEAM;

export default function getDepartmentByUserId(userId: string | number): DepartmentName | null {
    const normalizedUserId = String(userId);

    for (const [department, ids] of Object.entries(SALES_TEAM) as [DepartmentName, readonly number[]][]) {
        if (ids.map(String).includes(normalizedUserId)) {
            return department;
        }
    }

    return null;
}

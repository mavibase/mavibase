export type RelationshipType = "oneToOne" | "oneToMany" | "manyToOne" | "manyToMany";
export type OnDeleteAction = "cascade" | "setNull" | "restrict";
export interface RelationshipAttribute extends BaseAttribute {
    type: "relationship";
    relationship: RelationshipConfig;
}
export interface RelationshipConfig {
    type: RelationshipType;
    relatedCollection: string;
    twoWay: boolean;
    twoWayKey?: string;
    onDelete: OnDeleteAction;
    side: "parent" | "child";
}
interface BaseAttribute {
    name: string;
    required?: boolean;
    indexed?: boolean;
}
export interface RelationshipMeta {
    id: string;
    sourceCollection: string;
    sourceAttribute: string;
    targetCollection: string;
    targetAttribute?: string;
    type: RelationshipType;
    onDelete: OnDeleteAction;
    twoWay: boolean;
    createdAt: Date;
}
export {};
//# sourceMappingURL=relationship.d.ts.map
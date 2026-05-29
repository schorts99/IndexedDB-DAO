import { Criteria, ValueObject, Entity as BaseEntity, Model } from "@schorts/shared-kernel";

export class IndexedDBCriteriaQueryExecutor {
  static execute<Entity extends BaseEntity<ValueObject, Model>>(
    entities: Entity[],
    criteria: Criteria,
  ): Entity[] {
    let results = [...entities];

    for (const { field, operator, value } of criteria.filters) {
      results = results.filter((entity) => {
        let fieldValue: any = entity[field as keyof Entity];

        if (fieldValue && typeof fieldValue === "object") {
          if ("value" in fieldValue) {
            fieldValue = fieldValue.value;
          }
        }

        switch (operator) {
          case "EQUAL": return fieldValue === value;
          case "NOT_EQUAL": return fieldValue !== value;
          case "GREATER_THAN": return fieldValue > value;
          case "LESS_THAN": return fieldValue < value;
          case "GREATER_THAN_OR_EQUAL": return fieldValue >= value;
          case "LESS_THAN_OR_EQUAL": return fieldValue <= value;
          case "IN": return Array.isArray(value) && value.includes(fieldValue);
          case "NOT_IN": return Array.isArray(value) && !value.includes(fieldValue);
          case "LIKE": return typeof fieldValue === "string" && fieldValue.includes(value);
          case "BETWEEN": return fieldValue >= value[0] && fieldValue <= value[1];
          default: return true;
        }
      });
    }

    for (const { field, direction } of criteria.orders) {
      results.sort((a: Entity, b: Entity) => {
        if (a[field as keyof Entity] < b[field as keyof Entity]) return direction === "ASC" ? -1 : 1;
        if (a[field as keyof Entity] > b[field as keyof Entity]) return direction === "ASC" ? 1 : -1;

        return 0;
      });
    }
  
    if (criteria.offset) results = results.slice(criteria.offset);
    if (criteria.limit) results = results.slice(0, criteria.limit);
  
    return results;
  }
}

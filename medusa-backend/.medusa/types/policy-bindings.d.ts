declare module '@medusajs/framework/utils' {
  /**
   * RBAC Resource registry with lowercase keys for type-safe access.
   * All resource names are normalized to lowercase.
   * 
   * @example
   * import { PolicyResource } from '@medusajs/framework/utils'
   * 
   * const productResource = PolicyResource.product // "product"
   * const apiKeyResource = PolicyResource.api_key // "api-key"
   */
  export const Resource: {
    readonly api_key: "api-key"
    readonly campaign: "campaign"
    readonly claim: "claim"
    readonly collection: "collection"
    readonly currency: "currency"
    readonly customer: "customer"
    readonly customer_group: "customer-group"
    readonly draft_order: "draft-order"
    readonly exchange: "exchange"
    readonly fulfillment: "fulfillment"
    readonly fulfillment_provider: "fulfillment-provider"
    readonly fulfillment_set: "fulfillment-set"
    readonly inventory: "inventory"
    readonly inventory_item: "inventory-item"
    readonly invite: "invite"
    readonly locale: "locale"
    readonly notification: "notification"
    readonly order: "order"
    readonly order_change: "order-change"
    readonly order_edit: "order-edit"
    readonly payment: "payment"
    readonly payment_collection: "payment-collection"
    readonly payment_provider: "payment-provider"
    readonly price_list: "price-list"
    readonly price_preference: "price-preference"
    readonly product: "product"
    readonly product_category: "product-category"
    readonly product_tag: "product-tag"
    readonly product_type: "product-type"
    readonly product_variant: "product-variant"
    readonly promotion: "promotion"
    readonly rbac: "rbac"
    readonly refund_reason: "refund-reason"
    readonly region: "region"
    readonly reservation: "reservation"
    readonly return: "return"
    readonly return_reason: "return-reason"
    readonly sales_channel: "sales-channel"
    readonly shipping_option: "shipping-option"
    readonly shipping_option_type: "shipping-option-type"
    readonly shipping_profile: "shipping-profile"
    readonly stock_location: "stock-location"
    readonly store: "store"
    readonly tax: "tax"
    readonly tax_provider: "tax-provider"
    readonly tax_rate: "tax-rate"
    readonly tax_region: "tax-region"
    readonly translation: "translation"
    readonly upload: "upload"
    readonly user: "user"
    readonly workflow_execution: "workflow-execution"
  }

  /**
   * RBAC Operation registry with lowercase keys for type-safe access.
   * All operation names are normalized to lowercase.
   * 
   * @example
   * import { PolicyOperation } from '@medusajs/framework/utils'
   * 
   * const readOp = PolicyOperation.read // "read"
   */
  export const Operation: {
    readonly read: "read"
    readonly write: "write"
    readonly update: "update"
    readonly delete: "delete"
    readonly *: "*"
  }

  /**
   * RBAC Policy registry with all defined policies.
   * Maps policy names to their resource and operation pairs.
   * 
   * @example
   * import { Policy } from '@medusajs/framework/utils'
   * 
   * const readProduct = Policy.ReadProduct
   * // { resource: "product", operation: "read" }
   */
  export const Policy: {}
}
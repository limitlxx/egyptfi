import { Abi } from "starknet";

export const EGYPTFI_ABI: Abi = [
  {
    "type": "impl",
    "name": "UpgradeableImpl",
    "interface_name": "openzeppelin_upgrades::interface::IUpgradeable"
  },
  {
    "type": "interface",
    "name": "openzeppelin_upgrades::interface::IUpgradeable",
    "items": [
      {
        "type": "function",
        "name": "upgrade",
        "inputs": [
          {
            "name": "new_class_hash",
            "type": "core::starknet::class_hash::ClassHash"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "impl",
    "name": "EgyptFiImpl",
    "interface_name": "safebox::IEgyptFi"
  },
  {
    "type": "struct",
    "name": "core::integer::u256",
    "members": [
      {
        "name": "low",
        "type": "core::integer::u128"
      },
      {
        "name": "high",
        "type": "core::integer::u128"
      }
    ]
  },
  {
    "type": "enum",
    "name": "core::bool",
    "variants": [
      {
        "name": "False",
        "type": "()"
      },
      {
        "name": "True",
        "type": "()"
      }
    ]
  },
  {
    "type": "struct",
    "name": "safebox::Merchant",
    "members": [
      {
        "name": "is_active",
        "type": "core::bool"
      },
      {
        "name": "usdc_balance",
        "type": "core::integer::u256"
      },
      {
        "name": "total_payments_received",
        "type": "core::integer::u256"
      },
      {
        "name": "total_payments_count",
        "type": "core::integer::u64"
      },
      {
        "name": "withdrawal_address",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "metadata_hash",
        "type": "core::felt252"
      },
      {
        "name": "joined_timestamp",
        "type": "core::integer::u64"
      }
    ]
  },
  {
    "type": "enum",
    "name": "safebox::PaymentStatus",
    "variants": [
      {
        "name": "Pending",
        "type": "()"
      },
      {
        "name": "Completed",
        "type": "()"
      },
      {
        "name": "Refunded",
        "type": "()"
      },
      {
        "name": "Failed",
        "type": "()"
      }
    ]
  },
  {
    "type": "struct",
    "name": "safebox::Payment",
    "members": [
      {
        "name": "payment_id",
        "type": "core::felt252"
      },
      {
        "name": "merchant",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "customer",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "amount_paid",
        "type": "core::integer::u256"
      },
      {
        "name": "usdc_amount",
        "type": "core::integer::u256"
      },
      {
        "name": "status",
        "type": "safebox::PaymentStatus"
      },
      {
        "name": "timestamp",
        "type": "core::integer::u64"
      },
      {
        "name": "reference",
        "type": "core::felt252"
      },
      {
        "name": "description",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "interface",
    "name": "safebox::IEgyptFi",
    "items": [
      {
        "type": "function",
        "name": "register_merchant",
        "inputs": [
          {
            "name": "withdrawal_address",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "metadata_hash",
            "type": "core::felt252"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "update_merchant_withdrawal_address",
        "inputs": [
          {
            "name": "new_withdrawal_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "update_merchant_metadata",
        "inputs": [
          {
            "name": "new_metadata_hash",
            "type": "core::felt252"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "deactivate_merchant",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "create_payment",
        "inputs": [
          {
            "name": "merchant",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "amount",
            "type": "core::integer::u256"
          },
          {
            "name": "reference",
            "type": "core::felt252"
          },
          {
            "name": "description",
            "type": "core::felt252"
          }
        ],
        "outputs": [
          {
            "type": "core::felt252"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "process_payment",
        "inputs": [
          {
            "name": "payment_id",
            "type": "core::felt252"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "withdraw_funds",
        "inputs": [
          {
            "name": "amount",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "refund_payment",
        "inputs": [
          {
            "name": "payment_id",
            "type": "core::felt252"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "get_merchant",
        "inputs": [
          {
            "name": "merchant",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "safebox::Merchant"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_payment",
        "inputs": [
          {
            "name": "payment_id",
            "type": "core::felt252"
          }
        ],
        "outputs": [
          {
            "type": "safebox::Payment"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_merchant_payments",
        "inputs": [
          {
            "name": "merchant",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "offset",
            "type": "core::integer::u64"
          },
          {
            "name": "limit",
            "type": "core::integer::u64"
          }
        ],
        "outputs": [
          {
            "type": "core::array::Array::<core::felt252>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "verify_payment",
        "inputs": [
          {
            "name": "payment_id",
            "type": "core::felt252"
          },
          {
            "name": "merchant",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "toggle_emergency_pause",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "update_platform_fee",
        "inputs": [
          {
            "name": "new_fee_percentage",
            "type": "core::integer::u16"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "update_min_payment_amount",
        "inputs": [
          {
            "name": "new_min_amount",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "is_paused",
        "inputs": [],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "impl",
    "name": "OwnableMixinImpl",
    "interface_name": "openzeppelin_access::ownable::interface::OwnableABI"
  },
  {
    "type": "interface",
    "name": "openzeppelin_access::ownable::interface::OwnableABI",
    "items": [
      {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "transfer_ownership",
        "inputs": [
          {
            "name": "new_owner",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "renounce_ownership",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "transferOwnership",
        "inputs": [
          {
            "name": "newOwner",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "renounceOwnership",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "constructor",
    "name": "constructor",
    "inputs": [
      {
        "name": "owner",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "usdc_token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "platform_fee_percentage",
        "type": "core::integer::u16"
      },
      {
        "name": "platform_fee_collector",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "min_payment_amount_usd",
        "type": "core::integer::u256"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
    "kind": "struct",
    "members": [
      {
        "name": "previous_owner",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "new_owner",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
    "kind": "struct",
    "members": [
      {
        "name": "previous_owner",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "new_owner",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "OwnershipTransferred",
        "type": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
        "kind": "nested"
      },
      {
        "name": "OwnershipTransferStarted",
        "type": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
        "kind": "nested"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_security::reentrancyguard::ReentrancyGuardComponent::Event",
    "kind": "enum",
    "variants": []
  },
  {
    "type": "event",
    "name": "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Upgraded",
    "kind": "struct",
    "members": [
      {
        "name": "class_hash",
        "type": "core::starknet::class_hash::ClassHash",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "Upgraded",
        "type": "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Upgraded",
        "kind": "nested"
      }
    ]
  },
  {
    "type": "event",
    "name": "safebox::EgyptFi::MerchantRegistered",
    "kind": "struct",
    "members": [
      {
        "name": "merchant",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "timestamp",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "safebox::EgyptFi::MerchantUpdated",
    "kind": "struct",
    "members": [
      {
        "name": "merchant",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "field",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "timestamp",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "safebox::EgyptFi::PaymentCreated",
    "kind": "struct",
    "members": [
      {
        "name": "payment_id",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "merchant",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "customer",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "amount",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "reference",
        "type": "core::felt252",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "safebox::EgyptFi::PaymentCompleted",
    "kind": "struct",
    "members": [
      {
        "name": "payment_id",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "merchant",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "customer",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "usdc_amount",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "timestamp",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "safebox::EgyptFi::PaymentRefunded",
    "kind": "struct",
    "members": [
      {
        "name": "payment_id",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "merchant",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "customer",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "refund_amount",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "timestamp",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "safebox::EgyptFi::WithdrawalMade",
    "kind": "struct",
    "members": [
      {
        "name": "merchant",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "amount",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "to_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "timestamp",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "safebox::EgyptFi::EmergencyPauseToggled",
    "kind": "struct",
    "members": [
      {
        "name": "paused",
        "type": "core::bool",
        "kind": "data"
      },
      {
        "name": "timestamp",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "safebox::EgyptFi::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "OwnableEvent",
        "type": "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
        "kind": "flat"
      },
      {
        "name": "ReentrancyGuardEvent",
        "type": "openzeppelin_security::reentrancyguard::ReentrancyGuardComponent::Event",
        "kind": "flat"
      },
      {
        "name": "UpgradeableEvent",
        "type": "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Event",
        "kind": "flat"
      },
      {
        "name": "MerchantRegistered",
        "type": "safebox::EgyptFi::MerchantRegistered",
        "kind": "nested"
      },
      {
        "name": "MerchantUpdated",
        "type": "safebox::EgyptFi::MerchantUpdated",
        "kind": "nested"
      },
      {
        "name": "PaymentCreated",
        "type": "safebox::EgyptFi::PaymentCreated",
        "kind": "nested"
      },
      {
        "name": "PaymentCompleted",
        "type": "safebox::EgyptFi::PaymentCompleted",
        "kind": "nested"
      },
      {
        "name": "PaymentRefunded",
        "type": "safebox::EgyptFi::PaymentRefunded",
        "kind": "nested"
      },
      {
        "name": "WithdrawalMade",
        "type": "safebox::EgyptFi::WithdrawalMade",
        "kind": "nested"
      },
      {
        "name": "EmergencyPauseToggled",
        "type": "safebox::EgyptFi::EmergencyPauseToggled",
        "kind": "nested"
      }
    ]
  }
];
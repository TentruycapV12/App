// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Guestbook {
    struct Entry {
        address signer;
        string name;
        string message;
        uint256 timestamp;
    }

    error NameEmpty();
    error MessageEmpty();
    error NameTooLong(uint256 length, uint256 maxLength);
    error MessageTooLong(uint256 length, uint256 maxLength);

    uint256 private constant MAX_NAME_LENGTH = 50;
    uint256 private constant MAX_MESSAGE_LENGTH = 200;

    Entry[] private _entries;

    event Signed(address indexed signer, string name, string message, uint256 timestamp);

    function sign(string calldata name, string calldata message) external {
        uint256 nameLength = bytes(name).length;
        uint256 messageLength = bytes(message).length;

        if (nameLength == 0) revert NameEmpty();
        if (messageLength == 0) revert MessageEmpty();
        if (nameLength > MAX_NAME_LENGTH) revert NameTooLong(nameLength, MAX_NAME_LENGTH);
        if (messageLength > MAX_MESSAGE_LENGTH) {
            revert MessageTooLong(messageLength, MAX_MESSAGE_LENGTH);
        }

        uint256 timestamp = block.timestamp;

        _entries.push(
            Entry({
                signer: msg.sender,
                name: name,
                message: message,
                timestamp: timestamp
            })
        );

        emit Signed(msg.sender, name, message, timestamp);
    }

    function getEntries(uint256 offset, uint256 limit) external view returns (Entry[] memory) {
        uint256 length = _entries.length;
        if (offset >= length) {
            return new Entry[](0);
        }

        uint256 available = length - offset;
        uint256 count = limit < available ? limit : available;
        Entry[] memory sliced = new Entry[](count);

        for (uint256 i = 0; i < count; i++) {
            sliced[i] = _entries[length - 1 - (offset + i)];
        }

        return sliced;
    }

    function getEntryCount() external view returns (uint256) {
        return _entries.length;
    }
}

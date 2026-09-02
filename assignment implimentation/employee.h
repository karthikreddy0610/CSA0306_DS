#ifndef EMPLOYEE_H
#define EMPLOYEE_H

#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

#define TABLE_SIZE 1009 // Prime number for better distribution

// --- DATABASE STRUCTURES ---
typedef struct Node {
    int emp_id;
    struct Node* next;
} Node;

typedef struct {
    Node** table;
} ChainingTable;

typedef struct {
    int* table;
    bool* occupied;
} OpenAddrTable;

// --- DATABASE FUNCTIONS (Member 1) ---
ChainingTable* init_chaining_db();
OpenAddrTable* init_open_db();
void free_chaining_db(ChainingTable* db);
void free_open_db(OpenAddrTable* db);

// --- BACKEND FUNCTIONS (Member 2) ---
int hash_function(int emp_id);
int insert_chaining(ChainingTable* db, int emp_id);
bool search_chaining(ChainingTable* db, int emp_id);
int insert_linear(OpenAddrTable* db, int emp_id);
bool search_linear(OpenAddrTable* db, int emp_id);
int insert_quadratic(OpenAddrTable* db, int emp_id);
bool search_quadratic(OpenAddrTable* db, int emp_id);

#endif
